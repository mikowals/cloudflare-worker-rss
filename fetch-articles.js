import Parser from 'rss-parser';
import { filter, flatMap } from 'lodash';
import { Article } from './article';

let parser = new Parser({
  customFields: {
    item: [
      ['creator', 'author'],
      ['content', 'summary'],
      ['pubDate', 'date'],
    ]
  }
});

const fetchFeeds = async (url) => {
  console.time(url);
  const httpResponse = await fetch(url);
  const rssString = await httpResponse.text();
  console.timeEnd(url);
  let feed = await parser.parseString(rssString);
  console.log(feed.items[0]);
  feed.etag = httpResponse.headers.etag
  feed.lastModified = httpResponse.headers["last-modified"]
  return feed;
};

export const fetchArticles = async (feedURLs) => {
  const feeds = await Promise.all(feedURLs.map(fetchFeeds));
  //const feeds = await Promise.all(pagePromises.map(parseFeed));
  return flatMap(feeds, prepareArticlesForDB);
};

const prepareArticlesForDB = (feed) => {
  let articles = feed.items.map(article => {
    return new Article(article, feed);
  });
  return removeOldArticles(articles, 2);
}
const removeOldArticles = (articles, daysOld) => {
  let twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - daysOld);
  return filter(articles, (value) => {
    return value.date >= twoDaysAgo;
  });
};
