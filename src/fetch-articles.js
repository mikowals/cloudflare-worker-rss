import Parser from 'rss-parser';
import filter from 'lodash.filter'
import flatMap from 'lodash.flatmap';
import { Article } from './article';
import { yesterday } from './utils';

let parser = new Parser({
  customFields: {
    item: [
      ['author', 'author'],
      ['description', 'summary'],
      ['pubDate', 'date'],
    ]
  }
});

//
class PubdateHandler {
  constructor(keepLimitDate) {
    let self = this;
    self.keepLimitDate = keepLimitDate;
    self.dropItems = false;
    self.dateText = '';
    self.kept = 0;
    self.dropped = 0;

    self.itemHandler = {
      element(item) {
        if (self.dropItems) {
          item.remove();
          self.dropped++
        } else {
          self.kept++;
        }
      }
    }
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

let rewriter = new HTMLRewriter();

export const fetchFeed = ({url, _id, lastModified, etag}) => {
  const headers = new Headers({
    "If-Modified-Since": lastModified,
    "If-None-Match": etag
  });
  return fetch(new Request(url, {headers}));
}

export const readItems = async (feed) => {
  let self = this;
  if (! feed._id) {
    throw new Error("readItems requires feed with '_id'.")
  }
  const httpResponse = await feed.request;
  if (httpResponse.status !== 200) {
    console.log("Feed at " + feed.url + " not fetched.");
    console.log("Returned status code " +  httpResponse.status + ".")
    return feed;
  }
  let oneDayAgo = new Date().setDate(new Date().getDate() - 1);
  let dateHandler = new PubdateHandler(feed.lastFetchedDate);
  const truncatedResponse = rewriter
    .on('pubdate', dateHandler)
    .on('item', dateHandler.itemHandler)
    .transform(httpResponse);
  //console.log(feed.title, " kept: ", dateHandler.kept, " dropped: ", dateHandler.dropped);
  const rssString = await truncatedResponse.text();
  let updatedFeed = await parser.parseString(rssString);
  updatedFeed.etag = httpResponse.headers.etag
  updatedFeed.lastModified = httpResponse.headers["last-modified"];
  // Update url in case it has been redirected.
  updatedFeed.url = updatedFeed.feedUrl;
  updatedFeed._id = feed._id;
  updatedFeed.lastFetchedDate = feed.lastFetchedDate;
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
  return feed.items.map(item => new Article(item, feed));
}
