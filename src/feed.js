import { Article } from './article';
import { articles, feeds } from './database';
import { fetchRSS } from './fetchRSS';
import omit from 'lodash.omit';
import pick from 'lodash.pick';
import { v4 as uuidv4 } from 'uuid';

/**
* Feed - a dictionary of helper functions to deal with feed objects.
* A feed object may have the following properties:
*     '_id' {String} - REQUIRED - A unique id for the feed and associated Articles.
*     '$loki' {Number} - An index used by lokijs database.
*     'date' {Number} - The last published date of the feed in milliseconds.
*     'items' {Array<String>} - A list of published items.
*     'lastFetchedDate' {Number} - Time of the last fetch in milliseconds.
*     'meta' {Object} - Some lokijs database information.
*     'title' {String} - The publishers description of the feed.
*     'url' {String} - REQUIRED - A unique URL where the feed can be found.
*/
export let Feed = {};

Feed.createFromURL = async function(url) {
  let feed = this.maybeAddId({url});
  feed = await this.fetch(feed);
  return this.insert(feed);
}

Feed.fetch = async function(feed) {
  const fetchedFeed = await fetchRSS(feed);
  const customProperties = {
    date: new Date(fetchedFeed.pubDate || fetchedFeed.lastBuildDate).getTime(),
    lastFetchedDate: new Date().getTime()
  };
  return Object.assign(
    {},
    feed,
    pick(fetchedFeed, ['items', 'title']),
    customProperties,
  );
}

Feed.insert = function(feed) {
  Array.isArray(feed.items) && Feed.insertArticles(feed);
  return feeds.insert(omit(feed, ['items']));
}

/**
* InsertArticles - Add items to the articles collection after formatting.
* Along with 'items' to be inserted the feed requires an '_id' so created
* Articles can be searched by the source feed.
* Returns an Array of inserted Articles.
*
* @param {Object} feed - An RSS feed containing an ID and items.
*/

Feed.insertArticles = function(feed) {
  if (! feed._id){
    throw new Error(
      "Feed.insertArticles requires '_id' on feed.  Got: " +
      JSON.stringify(feed)
    );
  }
  let insertedArticles = [];
  feed.items.forEach(item => {
    articles.by("link", item.link)
    if (articles.by("link", item.link) || articles.by("summary", item.summary)) {
      return;
    }
    try {
      const article = new Article(item, feed);
      articles.insert(article);
      insertedArticles.push(article);
    } catch(e) {console.log(e.message)}
  });
  return insertedArticles;
};

/**
* MaybeAddId - Adds a unique '_id' to an object that is missing it.
* Useful before inserting to the database.
* Returns the passed Object unchanged or with a new '_id'.
*
* @param {Object} feed - An RSS feed.
*/
Feed.maybeAddId = function(feed) {
  if (! feed._id) {
    return Object.assign({}, feed, {_id: uuidv4()});
  }
  return feed;
}

/**
* Update - Performs a database update of the passed feed and inserts
* any new items into the articles collection.
* Returns an Array of inserted Articles.
*
* @param {Object} feed - A document from the feeds collection that has changed.
**/
Feed.update = function(feed) {
  const articles = Array.isArray(feed.items) ? Feed.insertArticles(feed) : [];
  feeds.update(omit(feed, ['items']));
  return articles;
}
