import Parser from 'rss-parser';
import { Article } from './article';
import { yesterday } from './utils';
import isEmpty from 'lodash.isEmpty';
const parseString = require('xml2js').parseString;

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

class ItemHandler2 {
  constructor(feed) {
    this.items = feed.items;
    this.feed = feed
    this.item = {};
    this.value = "";
  }
  element() {
    if (this.item.pubDate && this.items.length < 5) {
      const copy = Object.assign({}, this.item);
      this.items.push(copy)
      this.item = {};
    }
  }
}

class Handler {
  constructor(parent) {
    this.tagName;
    this.value = '';
    this.parent = parent;
  }

  element({tagName}) {
    this.tagName = tagName === 'guid' ? 'link' : tagName;
    this.parent.feed["item " + tagName] = tagName;
  }

  text(text) {
    this.value += text.text;
    console.log(this.tagName, " text: ", this.value);
    if (text.lastInTextNode) {
      let copy = this.value.slice();
      if (copy.startsWith("<![CDATA[")) {
        copy = copy.replace("<![CDATA[", "");
        copy = copy.replace("]]>", "");
      }
      this.parent.item[this.tagName] = copy;
      this.value = '';
    }
  }
}

export const fetchFeed = ({url, _id, lastModified, etag}) => {
  const headers = new Headers({
    "If-Modified-Since": lastModified,
    "If-None-Match": etag
  });
  return fetch(new Request(url, {headers}));
}

export const readItems = async (feed) => {
  const self = this;
  if (! feed._id) {
    throw new Error("readItems requires feed with '_id'.")
  }
  const httpResponse = await feed.request;
  if (httpResponse.status !== 200) {
    console.log("Feed at " + feed.url + " not fetched.");
    console.log("Returned status code " +  httpResponse.status + ".")
    return feed;
  }
  if (yesterday() > feed.lastFetchedDate) {
    feed.lastFetchedDate = yesterday();
  }
  // HTMLRewriter outside of concurrent feed response leads to
  // overwriting and only the items of the first httpResponse being kept.
  const rewriter = new HTMLRewriter();
  //const dateHandler = new PubdateHandler(feed.lastFetchedDate);
  let updatedFeed = {title: feed.title, items: []};
  const itemHandler = new ItemHandler2(updatedFeed);
  const truncatedResponse = rewriter
    .on('item > pubDate', new Handler(itemHandler))
    //.on('item > title', new Handler(itemHandler))
    //.on('item > guid', new Handler(itemHandler))
    .on('description', new Handler(itemHandler))
    .on('item', itemHandler)
    .transform(httpResponse);
  const rssString = await truncatedResponse.text();
  console.log(JSON.stringify(updatedFeed));
  updatedFeed = await parser.parseString(rssString);
  updatedFeed.etag = httpResponse.headers.etag
  updatedFeed.lastModified = httpResponse.headers["last-modified"];
  // Update url in case it has been redirected.
  updatedFeed.url = updatedFeed.feedUrl || feed.url;
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
  return updatedFeeds.flatMap(prepareArticlesForDB);
};

export const prepareArticlesForDB = (feed) => {
  if (isEmpty(feed.items)) {
    return [];
  }
  return feed.items.map(item => new Article(item, feed));
}
