import { Article } from './article';
import { v4 as uuidv4 } from 'uuid';

// Makes sure feed has an `_id` and `items` are suitiable for db.
// Currently separation of concerns is poor as '$loki' and 'meta' are  kept
// for lokijs collection update while fetchRSS.js does mapping from rss
// result to this function.
// This could have a 'subscribers' property as a db denormalization.

export const createFeed = ({
    _id = uuidv4(),
    $loki,
    date,
    etag,
    items,
    lastFetchedDate,
    lastModified,
    meta,
    title,
    url
  } = {}) => {
    let feed = {
      _id,
      $loki,
      date: new Date(date || pubDate || 0).getTime(),
      etag,
      items: items || undefined,
      lastFetchedDate: new Date(lastFetchedDate || 0).getTime(),
      lastModified,
      meta,
      title,
      url
    };
    // 'items' processed here to make sure we have the '_id' already.
    if (Array.isArray(feed.items)) {
      let articles = [];
      for (let ii = 0; ii < feed.items.length; ii++) {
        articles.push(new Article(feed.items[ii], feed))
      }
      feed.items = articles;
    }
    return feed;
  }
