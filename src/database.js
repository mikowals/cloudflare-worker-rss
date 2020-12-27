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
import faunadb,{ query as q } from 'faunadb';

let lokiDb = new loki("rss");

export let articles;
export let feeds;
export let users;

let client = null;

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
    unique: ["id", "link", "summary"],
    indices: ["date", "feedId"]
  });
  feeds = getCollection({
    name: "feeds",
    unique: ["id", "url"],
    indices: ["id", "url"]
  });
  users = getCollection({
    name: "users",
    unique: ["id"],
    indices: ["id"]
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
  client = new faunadb.Client({
    secret: GRAPHQL_SECRET_KEY,
    fetch
  });
  // initialize after db loaded from disk but before any use.
  initializeDb();
  const user = users.findOne();
  user && console.log("timeStamp: ", user.timeStamp, " articleCount: ", articles.count());
  if (feeds && feeds.count() > 0){
    return true;
  }
  // If feeds not found in KV then recreate feeds and articles from defaults.
  await Promise.all(defaultFeeds.map(insertNewFeedWithArticles));
  event.waitUntil(backupDb());
  return true;
}

const logDetailsToDb = () => {
  const details = {
    id: "nullUser",
    timeStamp: new Date().toUTCString(),
    articleCount: articles.count()
  };
  if (users.count() === 0) {
    users.insert(details);
  } else {
    const user = users.findOne({id: details.id})
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

export const insertNewFeedWithArticles = async (feed) => {
  const existingFeed = feeds.findOne({url: feed.url});
  if (existingFeed) {
    return existingFeed;
  }
  if (! feed.id) {
    feed.id = uuidv4();
  }
  feed.request = fetchFeed(feed);
  const feedResult = await readItems(feed);
  const dbArticles = prepareArticlesForDB(feedResult);
  await client.query(
    q.Map(
      dbArticles,
      q.Lambda(
        "article",
        q.Create(q.Collection("articles"), {data: q.Var("article")})
      )
    )
  );
  //articles.insert(dbArticles);
  let feedForInsert = pick(feedResult, [
    'id',
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
  await client.query(
    q.Create(q.Collection("feeds"), {data: feedForInsert})
  )
  //feeds.insert(feedForInsert);
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

export const fetchArticlesByFeedIds = async (feedIds) => {
  const { data } = await client.query(
    q.Call(
      q.Function('articles_search_by_feedId_sort_by_date_title'),
      feedIds
    )
  )
  console.log(JSON.stringify(data[0]));
  return data;
}
