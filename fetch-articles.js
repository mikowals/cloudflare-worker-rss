import Parser from 'rss-parser';
import { filter, flatMap } from 'lodash';

const timedFetch = async (url) => {
  console.time(url);
  const httpResponse = await fetch(url);
  console.timeEnd(url);
  return httpResponse;
};

const parseFeed = async (pagePromise) => {
  const pageResponse = await pagePromise;
  const rssString = await pageResponse.text();
  let feed = await new Parser().parseString(rssString);
  return removeOldArticles(feed.items, 2);
};

export const fetchArticles = async (feedURLs) => {
  const pagePromises = feedURLs.map(timedFetch);
  const articlesByFeed = await Promise.all(pagePromises.map(parseFeed));
  return articlesByFeed.flat();
};

const removeOldArticles = (articles, daysOld) => {
  let twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - daysOld);
  return filter(articles, (value) => {
    return new Date(value.pubDate) >= twoDaysAgo;
  });
};
