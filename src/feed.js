import { Article } from './article';
import { articles, feeds } from './database';
import { fetchRSS } from './fetchRSS';
import pick from 'lodash.pick';
import { v4 as uuidv4 } from 'uuid';

export let Feed = {};

Feed.fetch = async function(feed) {
  const fetchedFeed = await fetchRSS(feed);
  const updates = {
    date: new Date(fetchedFeed.pubDate || fetchedFeed.lastBuildDate).getTime(),
    etag: fetchedFeed.etag,
    items: fetchedFeed.items,
    lastFetchedDate: new Date().getTime(),
    lastModified: fetchedFeed.lastModified,
    title: fetchedFeed.title,
    url: fetchedFeed.feedUrl || feed.url
  };
  return Object.assign(feed, updates);
}

Feed.insert = function(feed) {
  Array.isArray(feed.items) && Feed.insertArticles(feed);
  return Object.assign(feed, feeds.insert(feed))
}

Feed.insertArticles = function(feed) {
  if (! feed._id){
    throw new Error(
      "Feed.insertArticles requires '_id' on feed.  Got: " +
      JSON.stringify(feed)
    );
  }
  let insertedArticles = [];
  for (let ii = 0; ii < feed.items.length; ii++) {
    try {
      const article = new Article(feed.items[ii], feed);
      articles.insert(article);
      insertedArticles.push(article);
    } catch(e) {}
  }
  delete feed.items;
  return insertedArticles;
};

Feed.maybeAddId = function(feed) {
  if (! feed._id) {
    feed._id = uuidv4();
  }
  return feed;
}

Feed.update = function(feed) {
  const articles = Array.isArray(feed.items) ? Feed.insertArticles(feed) : [];
  Object.assign(feed, feeds.update(feed));
  return articles;
}
