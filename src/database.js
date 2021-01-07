import { updateFeedAfterFetch } from './feed';
import { parseFeed } from './fetchRSS';
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
  //unique.forEach(key => collection.ensureUniqueIndex(key));
  //indices.forEach(key => collection.ensureIndex(key));
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
    indices: []
  });
  users = getCollection({
    name: "users",
    unique: ["_id"],
    indices: []
  });
};

const defaultFeeds = [
  //{url: "http://feeds.bbci.co.uk/news/education/rss.xml"},
  //{url: "https://www.abc.net.au/news/feed/51120/rss.xml"},
  //{url: "http://feeds.bbci.co.uk/news/world/rss.xml"},
  {url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"},
  //{url: "http://scripting.com/rss.xml"}
];

export const maybeLoadDb = async (event) => {
  // Try to reflate lokijs from kv storage
  const jsonDb = await RSS.get('jsonDb');
  if (jsonDb) {
    lokiDb.loadJSON(jsonDb)
  }
  // initialize after db loaded from disk but before any use.
  initializeDb();
  //const user = users.findOne();
  //user && console.log("timeStamp: ", user.timeStamp, " articleCount: ", user.articleCount);
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
    articleCount: articles.count(),
    feedList: feeds.find().map(f => f._id)
  };
  if (users.count() === 0) {
    users.insert(details);
  } else {
    const user = users.by("_id", details._id)
    user.timeStamp = details.timeStamp;
    user.articleCount = details.articleCount;
    user.feedList = details.feedList;
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

export const insertNewFeedWithArticles = async ({url}) => {
  const existingFeed = feeds.by("url", url);
  if (existingFeed) {
    return existingFeed;
  }
  let feed = updateFeedAfterFetch({url}, await parseFeed({url}));
  insertArticlesIfNew(feed.items);
  delete feed.items;
  feeds.insert(feed);
  return feed;
}

const insertArticlesIfNew = (newArticles) => {
  let insertedArticles = [];
  for (let ii = 0; ii < newArticles.length; ii++) {
    try {
      const article = newArticles[ii];
      articles.insert(article);
      insertedArticles.push(article);
    } catch(e) {}
  }
  return insertedArticles;
}

export const updateFeedsAndInsertArticles = async (targetFeeds) => {

  let updatedFeeds = targetFeeds.map(async feed => {
    return updateFeedAfterFetch(feed, await parseFeed(feed));
  });

  let insertedArticles = await Promise.all(
    updatedFeeds.map(async feedPromise => {
      let feed = await feedPromise;
      const items = feed.items;
      delete feed.items;
      feeds.update(feed);
      return insertArticlesIfNew(items);
    })
  );

  return insertedArticles.flat();
}
