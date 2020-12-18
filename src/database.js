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

export let articles = lokiDb.getCollection("articles");
if (articles === null) {
  articles = lokiDb.addCollection("articles", {
    unique: ['link', '_id'],
    indices: ['_id', 'feedId', 'date']
  });
}

export let feeds = lokiDb.getCollection('feeds');
if (feeds === null) {
  feeds = lokiDb.addCollection('feeds',{
    unique: ['url'],
    indices: ['_id']
  });
}

const defaultFeeds = [
  {url: "http://feeds.bbci.co.uk/news/education/rss.xml"},
  {url: "https://www.abc.net.au/news/feed/51120/rss.xml"},
  {url: "http://feeds.bbci.co.uk/news/world/rss.xml"},
  {url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"},
  {url: "http://scripting.com/rss.xml"}
];

export const maybeLoadDb = async () => {
  // If we have feeds assume we have articles too.
  if (feeds.count() > 0) {
    return;
  }
  let kvFeeds = await loadFeedsFromKV();
  if (Array.isArray(kvFeeds) && kvFeeds.length > 0) {
    // Feeds recovered from KV and we should load articles to match.
    // keeping articles in KV may be faster but some mechanism needs to
    // be sure article fetching is in sync with Feed.lastFetchedDate and
    // Article.feedId matches a Feed._id.
    const newArticles = await fetchArticles(kvFeeds)
    articles.insert(newArticles);
    return;
  }
  // If feeds not found in KV then recreate feeds and articles from defaults.
  await Promise.all(defaultFeeds.map(insertNewFeedWithArticles));
}

export const saveCollectionToKV = async (collection, expirationTtl) => {
  const targetData = collection.find();
  return await RSS.put(
    collection.name,
    JSON.stringify(targetData),
    {expirationTtl}
  )
}

const loadFeedsFromKV = async () => {
  let kvRows = await RSS.get('feeds', 'json');
  // Loop over array because db.loadJSON doesn't fill collection.
  let kvFeeds = [];
  kvRows && kvRows.forEach(row => {
    try {
      delete row['$loki'];
      delete row.meta;
      // Reset some properties so next article fetch returns something.
      row.lastFetchedDate = yesterday();
      delete row.etag
      delete row.lastModified
      feeds.insert(row);
      kvFeeds = [...kvFeeds, row];
    } catch (e) {}
  });
  return kvFeeds;
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
  saveCollectionToKV(feeds)
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

export const insertArticlesIfNew = (newArticles) => {
  let insertedArticles = [];
  newArticles.forEach( article => {
    try {
      articles.insert(article);
      insertedArticles = [...insertedArticles, article];
    } catch(e) {}
  });
  return insertedArticles;
}
