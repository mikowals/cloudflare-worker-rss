import { Article } from './article';
import { v4 as uuidv4 } from 'uuid';

// Makes sure feed has an `_id` and `items` are suitiable for db.
// Currently separation of concerns is poor as '$loki' and 'meta' are  kept
// for lokijs collection update while fetchRSS.js does mapping from rss
// result to this function.
// This could have a 'subscribers' property as a db denormalization.

const createFeed = ({
    _id = uuidv4(),
    date,
    etag,
    items,
    lastFetchedDate = 0,
    lastModified,
    title,
    url
  } = {}) => {
    let feed = {
      _id,
      date: new Date(date || 0).getTime(),
      etag,
      items: prepareArticlesForDb(items, _id, title),
      lastFetchedDate,
      lastModified,
      title,
      url
    };
    // 'items' processed here to make sure we have the '_id' already.

    return feed;
  }

export const updateFeedAfterFetch = (feed, fetchedFeed) => {
  const _id = feed._id || uuidv4();
  const items = prepareArticlesForDb(
    fetchedFeed.items, _id, fetchedFeed.title
  );
  const updates = {
    _id
    date: new Date(fetchedFeed.pubDate || fetchedFeed.lastBuildDate).getTime(),
    etag: fetchedFeed.etag,
    items,
    lastFetchedDate: new Date().getTime(),
    lastModified: fetchedFeed.lastModified,
    title: fetchedFeed.title,
    url: fetchedFeed.feedUrl || feed.url
  };
  return Object.assign(feed, updates);
}

const prepareArticlesForDb = (items, _id, title) => {
  let articles = [];
  if (Array.isArray(items)) {
    for (let ii = 0; ii < items.length; ii++) {
      articles.push(new Article(items[ii], {_id, title}))
    }
  }
  return articles;
}
