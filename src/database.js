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
  await Promise.all(
    defaultFeeds.map(async feed => {
      Feed.maybeAddId(feed);
      await Feed.fetch(feed);
      return Feed.insert(feed);
    })
  );
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

// Each db mutation needs to get to kv.
export const backupDb = () => {
  logDetailsToDb();
  console.log("running backup")
  const json = lokiDb.serialize();
  return new Promise((resolved) => {
    RSS.put("jsonDb", json).then(resolved);
  });
};
