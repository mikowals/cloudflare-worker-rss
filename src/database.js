import loki from 'lokijs';
import { v4 as uuidv4 } from 'uuid';
import { fetchFeed, readItems, prepareArticlesForDB } from './fetch-articles';
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

// Because of Worker KV this function must run inside the request.
export const maybeLoadDbFromWorkerKV = async () => {
  if (articles.count() < 1) {
    await loadCollectionFromKV(articles);
  }
  if (feeds.count() < 1) {
    await loadCollectionFromKV(feeds);
  }
}

export const maybeSeedDbFeeds = () => {
  if (feeds.count() > 0) {
    return;
  }
  console.log("attempting to seed feeds");
  const feedURLs = [
    "http://feeds.bbci.co.uk/news/education/rss.xml",
    "https://www.abc.net.au/news/feed/51120/rss.xml",
    "http://feeds.bbci.co.uk/news/world/rss.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    "http://scripting.com/rss.xml"
  ];
  const newFeeds = feedURLs.map(url => {
    return {
      _id: uuidv4(),
      url,
      title: url,
      date: (new Date()).getTime(),
      subscribers: ["nullUser"]
    }
  });
  feeds.insert(newFeeds);
  console.log("feeds in db: ", JSON.stringify(feeds.find()));
}
export const saveCollectionToKV = async (collection) => {
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
  kvRows && kvRows.forEach(row => {

    try {
      delete row['$loki']
      delete row.meta
      collection.insert(row);
    } catch (e) {}
  });
  return true;
}

const addFeed = async (_id, url) => {
  const existingFeed = feeds.findOne({url});
  if (existingFeed) {
    return existingFeed;
  }
  const feed = await readItems(fetchFeed({_id, url}));
  articles.insert(prepareArticlesForDB(feed));
  feeds.insert({
    _id: feed._id,
    url: feed._url,
    date: feed.date,
    title: feed.title,
    subscribers: ["nullUser"]
  });
  return feed;
}
