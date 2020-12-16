import {
  fetchFeed,
  readItems,
  prepareArticlesForDB,
  fetchArticles
} from './fetch-articles';
import pick from 'lodash.pick';
import loki from 'lokijs';
import { yesterday } from './utils';
import { v4 as uuidv4 } from 'uuid';

let lokiDb = new loki("rss");

export let articles = lokiDb.getCollection("articles");
if (articles === null) {
  articles = lokiDb.addCollection("articles", {
    unique: ['link', '_id'],
    indices: ['_id', 'feedId', 'date']
  });
}

console.log("number of articles in database : " + articles.count());

export let feeds = lokiDb.getCollection('feeds');
if (feeds === null) {
  feeds = lokiDb.addCollection('feeds',{
    unique: ['url'],
    indices: ['_id']
  });
}

export const maybeLoadDb = async () => {
  if (feeds.count() > 0) {
    return;
  }
  let feedIds = await loadCollectionFromKV(feeds);
  if (Array.isArray(feedIds) && feedIds.length === 0) {
    await seedDbFeeds();
    return;
  }
  let articleIds = await loadCollectionFromKV(articles);
  if (articleIds.length < 1) {
    const newArticles = await fetchArticles(feeds.find({_id: {'$in': feedIds}}))
    articles.insert(newArticles);
  }
}
// Because of Worker KV this function must run inside the request.
const maybeLoadDbFromWorkerKV = async () => {
  let feedIds = [];
  if (articles.count() < 1) {
    feedIds = await loadCollectionFromKV(articles);
  }
  if (feedIds.length < 1) {
    feedIds = await seedDbFeeds;
  }
  return feedIds;
}

const seedDbFeeds = async () => {
  const feeds = [
    {url: "http://feeds.bbci.co.uk/news/education/rss.xml"},
    {url: "https://www.abc.net.au/news/feed/51120/rss.xml"},
    {url: "http://feeds.bbci.co.uk/news/world/rss.xml"},
    {url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"},
    {url: "http://scripting.com/rss.xml"}
  ];
  return await Promise.all(feeds.map(addFeed))
}
export const saveCollectionToKV = (collection) => {
  console.log("kv put for ", collection.name, " starting.");
  return RSS.put(
    collection.name,
    JSON.stringify(collection.find()),
    {expirationTtl: 2 * 24 * 60 * 60}
  ).then((result) => console.log("kv put for ", collection.name, " result: ", result));
}

const loadCollectionFromKV = async (collection) => {
  console.log("loading ", collection.name, " from kv.");
  let kvRows = await RSS.get(collection.name, 'json');
  // Loop over array because db.loadJSON doesn't fill collection.
  let ids = [];
  kvRows && kvRows.forEach(row => {
    try {
      delete row['$loki'];
      delete row.meta;
      const fetchLimitDate = yesterday();
      if (row.lastFetchedDate < fetchLimitDate ) {
        row.lastFetchedDate = fetchLimitDate;
      }
      collection.insert(row);
      ids = [...ids, row._id];
    } catch (e) {}
  });
  return ids;
}

export const addFeed = async (feed) => {
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
  saveCollectionToKV(articles)
  let feedForInsert = pick(feedResult, ['_id', 'url', 'date', 'title'])
  feedForInsert.subscribers = ['nullUser'];
  feedForInsert.lastFetchedDate = (new Date()).getTime();
  feeds.insert(feedForInsert);
  saveCollectionToKV(feeds)
  return feedForInsert;
}

export const updateLastFetchedDate = (targetFeeds) => {
  targetFeeds.forEach(feed => {
    feed.lastFetchedDate = (new Date()).getTime();
    feeds.update(feed);
  });
  saveCollectionToKV(feeds);
}

export const insertArticlesIfNew = (newArticles) => {
  let insertedArticles = [];
  newArticles.forEach( article => {
    try {
      articles.insert(article);
      insertedArticles = [...insertedArticles, article];
    } catch(e) {}
  });
  if (insertedArticles.length >0) {
    saveCollectionToKV(articles);
  }
  return insertedArticles;
}
