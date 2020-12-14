import Parser from 'rss-parser';
import { filter, flatMap } from 'lodash';
import { Article } from './article';

let parser = new Parser({
  customFields: {
    item: [
      ['author', 'author'],
      ['description', 'summary'],
      ['pubDate', 'date'],
    ]
  }
});

export const fetchFeed = async ({url, _id, lastModified, etag}) => {
  console.time(url);
  const headers = new Headers({
    "If-Modified-Since": lastModified,
    "If-None-Match": etag
  });
  return fetch(new Request(url, {headers}));
}

export const readItems = async ([feed, httpPromise]) => {
  if (! feed._id) {
    throw new Error("readItems requires feed with '_id'.")
  }
  const httpResponse = await httpPromise;
  const rssString = await httpResponse.text();
  console.timeEnd(feed.url);
  if (httpResponse.status !== 200) {
    console.log("Feed at " + feed.url + " not fetched.");
    console.log("Returned status code " +  httpResponse.status + ".")
    return feed;
  }

  let feedResult = await parser.parseString(rssString);
  //console.log(JSON.stringify(feed.items[0]));
  feedResult.etag = httpResponse.headers.etag
  feedResult.lastModified = httpResponse.headers["last-modified"];
  feedResult.url = feed.url;
  feedResult._id = feed._id;
  return feedResult;
};

export const fetchArticles = async (feeds) => {
  const feedsWithResponses = feeds.map(f => [f, fetchFeed(f)]);
  const feedsWithArticles = await Promise.all(feedsWithResponses.map(readItems));
  return flatMap(feedsWithArticles, prepareArticlesForDB);
};

export const prepareArticlesForDB = (feed) => {
  if (! feed.items) {
    return [];
  }
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
