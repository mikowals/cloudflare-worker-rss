import Parser from 'rss-parser';
import { Article } from './article';
import { yesterday } from './utils';
import isEmpty from 'lodash.isEmpty';

const parser = new Parser({
  customFields: {
    item: [
      ['author', 'author'],
      ['description', 'summary'],
      ['pubDate', 'date'],
    ]
  }
});

class PubdateHandler {
  constructor(keepLimitDate) {
    this.keepLimitDate = keepLimitDate;
    this.dropItems = false;
    this.dateText = '';
  }

  text(text) {
    if (! this.dropItems) {
      this.dateText += text.text;
      if (text.lastInTextNode){
        let date = new Date(this.dateText);
        if (date.getTime() < this.keepLimitDate) {
          this.dropItems = true;
        }
        this.dateText = '';
      }
    }
  }
}

class ItemHandler {
  constructor(pubdateHandler) {
    this.dropItems = () => pubdateHandler.dropItems;
    this.dropped = 0;
    this.kept = 0;
  }

  element(item) {
    if (this.dropItems()) {
      item.remove();
      this.dropped++;
    } else {
      this.kept++;
    }
  }

  log(id) {
    console.log("PubdateHandler - ", id, " kept: ", this.kept, " dropped: ", this.dropped)
  }
}

export const fetchRSS = ({url, _id, lastModified, etag}) => {
  const headers = new Headers({
    "If-Modified-Since": lastModified,
    "If-None-Match": etag
  });
  return fetch(new Request(url, {headers}),{
    cf: {
      cacheEverything: true,
      cacheTtlByStatus: {'200-299': 1200, 404: 1, '500-599': 0}
    }
  });
}

export const parseFeed = async ({feed, responsePromise}) => {
  if (! feed._id) {
    throw new Error("parseFeed requires feed with '_id'.")
  }
  const httpResponse = await responsePromise;
  if (httpResponse.status !== 200) {
    console.log("Feed at " + feed.url + " not fetched.");
    console.log("Returned status code " +  httpResponse.status + ".")
    return feed;
  }
  if (yesterday() > feed.lastFetchedDate) {
    feed.lastFetchedDate = yesterday();
  }
  // HTMLRewriter outside of concurrent feed response leads to
  // overwriting and only the items of the first httpResponse
  // to arrivebeing kept.
  const rewriter = new HTMLRewriter();
  const dateHandler = new PubdateHandler(feed.pubDate);
  const itemHandler = new ItemHandler(dateHandler);
  const truncatedResponse = rewriter
    .on('pubDate', dateHandler)
    .on('item', itemHandler)
    .transform(httpResponse);
  const rssString = await truncatedResponse.text();
  const updatedFeed = await parser.parseString(rssString);

  // This is a mess.  I am blending data from the
  // db feed, http response, and parsed rss.
  updatedFeed.items = prepareArticlesForDB(updatedFeed)
  updatedFeed.date = new Date(
    updatedFeed.pubDate || updatedFeed.lastBuildDate
  ).getTime();
  updatedFeed.etag = httpResponse.headers.etag
  updatedFeed.lastModified = httpResponse.headers["last-modified"];
  // Update url in case it has been redirected.
  updatedFeed.url = updatedFeed.feedUrl || feed.url;
  updatedFeed._id = feed._id;
  updatedFeed.lastFetchedDate = new Date().getTime();
  return updatedFeed;
};

export const fetchArticles = async (feeds) => {
  const feedsWithRequests = feeds.map(feed => {
    const responsePromise = fetchRSS(feed);
    return {feed, responsePromise};
  })
  const updatedFeeds = await Promise.all(feedsWithRequests.map(parseFeed));
  return updatedFeeds.flatMap(feed => feed.items);
};

// Loop articles again to parse into the format the db expects.
// This needs feed info along with article info.
const prepareArticlesForDB = (feed) => {
  if (isEmpty(feed.items)) {
    return [];
  }
  return feed.items.map(item => new Article(item, feed));
}
