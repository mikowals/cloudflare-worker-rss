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

export const readItems = async (feed) => {
  if (! feed._id) {
    throw new Error("readItems requires feed with '_id'.")
  }
  const httpResponse = await feed.request;
  const rssString = await httpResponse.text();
  console.timeEnd(feed.url);
  if (httpResponse.status !== 200) {
    console.log("Feed at " + feed.url + " not fetched.");
    console.log("Returned status code " +  httpResponse.status + ".")
    return feed;
  }

  let updatedFeed = await parser.parseString(rssString);
  //console.log(JSON.stringify(feed.items[0]));
  updatedFeed.etag = httpResponse.headers.etag
  updatedFeed.lastModified = httpResponse.headers["last-modified"];
  // Update url in case it has been redirected.
  updatedFeed.url = updatedFeed.feedUrl;
  updatedFeed._id = feed._id;
  return updatedFeed;
};

export const fetchArticles = async (feeds) => {
  const feedsWithRequests = feeds.map(f => {
    f.request = fetchFeed(f);
    return f;
  })
  const updatedFeeds = await Promise.all(feedsWithRequests.map(readItems));
  return flatMap(updatedFeeds, prepareArticlesForDB);
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
  let dayLimit = new Date();
  dayLimit.setDate(dayLimit.getDate() - daysOld);
  return filter(articles, (value) => {
    return value.date >= dayLimit;
  });
};
