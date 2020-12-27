import { Feed } from './feed';
import {
  fetchRSS,
  parseFeed,
  prepareArticlesForDB,
  fetchArticles
} from './fetchRSS';
import pick from 'lodash.pick';
import isEmpty from 'lodash.isempty'
import loki from 'lokijs';
import { yesterday } from './utils';

let lokiDb = new loki("rss");

export let articles;
export let feeds;
export let users;

const getCollection = ({name, unique, indices}) => {
  let collection = lokiDb.getCollection(name);
  if (collection === null) {
    console.log(name, " not found. Adding collection.");
    return lokiDb.addCollection(name, {unique, indices});
  }
  unique.forEach(key => collection.ensureUniqueIndex(key));
  indices.forEach(key => collection.ensureIndex(key));
  return collection;
}

const initializeDb = () => {
  articles = getCollection({
    name: "articles",
    unique: ["_id", "link", "summary"],
    indices: ["date", "feedId"]
  });
  feeds = getCollection({
    name: "feeds",
    unique: ["_id", "url"],
    indices: ["_id", "url"]
  });
  users = getCollection({
    name: "users",
    unique: ["_id"],
    indices: ["_id"]
  });
};

const defaultFeeds = [
  {url: "http://feeds.bbci.co.uk/news/education/rss.xml"},
  {url: "https://www.abc.net.au/news/feed/51120/rss.xml"},
  {url: "http://feeds.bbci.co.uk/news/world/rss.xml"},
  {url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"},
  {url: "http://scripting.com/rss.xml"}
];

export const maybeLoadDb = async (event) => {
  // Try to reflate lokijs from kv storage
  const jsonDb = await RSS.get('jsonDb');
  if (jsonDb) {
    lokiDb.loadJSON(jsonDb)
  }
  // initialize after db loaded from disk but before any use.
  initializeDb();
  const user = users.findOne();
  user && console.log("timeStamp: ", user.timeStamp, " articleCount: ", articles.count());
  if (feeds && feeds.count() > 0) {
    return true;
  }

  // If feeds not found in KV then recreate feeds and articles from defaults.
  await Promise.all(defaultFeeds.map(insertNewFeedWithArticles));
  event.waitUntil(backupDb());
  return true;
}

const logDetailsToDb = () => {
  const details = {
    _id: "nullUser",
    timeStamp: new Date().toUTCString(),
    articleCount: articles.count()
  };
  if (users.count() === 0) {
    users.insert(details);
  } else {
    const user = users.findOne({_id: details._id})
    user.timeStamp = details.timeStamp;
    user.articleCount = details.articleCount;
    users.update(user);
  }
}

//
export const backupDb = () => {
  logDetailsToDb();
  console.log("running backup")
  const json = lokiDb.serialize();
  return new Promise((resolved) => {
    RSS.put("jsonDb", json).then(resolved);
  });
};

// Fetch RSS feed details from a given URL and populate Loki with both
// the RSS feed and articles.  These could be separated but as fetching the
// URL will always return the articles too, just insert both.

// XXX Fix this to work with a 'users' database so that different users
// can see different set of feeds and articles.  See the 'Feed.subscribers'
// property placeholder.

export const insertNewFeedWithArticles = async (newFeed) => {
  const existingFeed = feeds.findOne({url: newFeed.url});
  if (existingFeed) {
    return existingFeed;
  }
  const feed = new Feed(newFeed);
  const responsePromise = fetchRSS(feed);
  const feedResult = await parseFeed({feed, responsePromise});
  articles.insert(feedResult.items);
  let feedForInsert = new Feed(feedResult, {keepItems: false});
  feeds.insert(feedForInsert);
  return feedForInsert;
}

const insertArticlesIfNew = (newArticles) => {
  let insertedArticles = [];
  newArticles.forEach( article => {
    try {
      articles.insert(article);
      insertedArticles = [...insertedArticles, article];
    } catch(e) {}
  });
  return insertedArticles;
}

export const updateFeedsAndInsertArticles = async (targetFeeds) => {
  const feedsWithRequests = targetFeeds.map(feed => {
    return {feed, responsePromise: fetchRSS(feed)}
  });
  const updatedFeeds = await Promise.all(feedsWithRequests.map(parseFeed));
  const newArticles = updatedFeeds.flatMap(f => f.items)
  targetFeeds.forEach((feed, ii) => {
    const {date, etag, lastFetchedDate, lastModified} = updatedFeeds[ii];
    feed.date = date;
    feed.etag = etag;
    feed.lastFetchedDate = lastFetchedDate;
    feed.lastModified = lastModified;
    feeds.update(feed);
  });
  return insertArticlesIfNew(newArticles);
}
