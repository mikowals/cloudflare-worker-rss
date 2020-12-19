import {
  fetchFeed,
  readItems,
  prepareArticlesForDB,
  fetchArticles
} from './fetch-articles';
import pick from 'lodash.pick';
import isEmpty from 'lodash.isempty'
import loki from 'lokijs';
import { yesterday } from './utils';
import { v4 as uuidv4 } from 'uuid';

let lokiDb = new loki("rss");

export let articles;
export let feeds;

const initializeDb = () => {
  feeds = lokiDb.getCollection('feeds');
  articles = lokiDb.getCollection("articles");
  if (feeds === null) {
    feeds = lokiDb.addCollection('feeds',{
      unique: ['url'],
      indices: ['_id']
    });
  }

  if (articles === null) {
    articles = lokiDb.addCollection("articles", {
      unique: ['link', '_id'],
      indices: ['_id', 'feedId', 'date']
    });
  }
}

const defaultFeeds = [
  {url: "http://feeds.bbci.co.uk/news/education/rss.xml"},
  {url: "https://www.abc.net.au/news/feed/51120/rss.xml"},
  {url: "http://feeds.bbci.co.uk/news/world/rss.xml"},
  {url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"},
  {url: "http://scripting.com/rss.xml"}
];

export const maybeLoadDb = async (event) => {
  // If we have feeds assume we have articles too.
  if (feeds && feeds.count() > 0) {
    return true;
  }
  // Try to reflate lokijs from kv storage
  const jsonDb = await RSS.get('jsonDb');
  if (jsonDb) {
    lokiDb.loadJSON(jsonDb)
  }
  initializeDb();
  if (feeds && feeds.count() > 0) {
    return true;
  }

  // If feeds not found in KV then recreate feeds and articles from defaults.
  await Promise.all(defaultFeeds.map(insertNewFeedWithArticles));
  backupDb(event);
  return true;
}

export const backupDb = (event) => {
  const json = lokiDb.serialize();
  return event.waitUntil(
    RSS.put("jsonDb", json, {expirationTtl: 2 * 24 * 60 *60})
  );
}

// Fetch RSS feed details from a given URL and populate Loki with both
// the RSS feed and articles.  These could be separated but as fetching the
// URL will always return the articles too, just insert both.

// XXX Fix this to work with a 'users' database so that different users
// can see different set of feeds and articles.  See the 'Feed.subscribers'
// property placeholder.

export const insertNewFeedWithArticles = async (feed) => {
  const existingFeed = feeds.findOne({url: feed.url});
  if (existingFeed) {
    return existingFeed;
  }
  if (! feed._id) {
    feed._id = uuidv4();
  }
  feed.request = fetchFeed(feed);
  const feedResult = await readItems(feed);
  articles.insert(prepareArticlesForDB(feedResult));
  let feedForInsert = pick(feedResult, [
    '_id',
    'url',
    'date',
    'title',
    'etag',
    'lastModified'
  ]);
  feedForInsert.subscribers = ['nullUser'];
  if (! isEmpty(feedResult.items)) {
    feedForInsert.lastFetchedDate = (new Date()).getTime();
  }
  feeds.insert(feedForInsert);
  return feedForInsert;
}

export const updateLastFetchedDate = (targetFeeds) => {
  targetFeeds.forEach(feed => {
    if (isEmpty(feed.items)) {
      return;
    }
    feed.lastFetchedDate = (new Date()).getTime();
    feeds.update(feed);
  });
}

export const insertArticlesIfNew = async (newArticles) => {
  let insertedArticles = [];
  newArticles.forEach( article => {
    try {
      articles.insert(article);
      insertedArticles = [...insertedArticles, article];
    } catch(e) {}
  });
  return insertedArticles;
}
