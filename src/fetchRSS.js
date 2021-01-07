import Parser from 'rss-parser';
import { Article } from './article';
import { createFeed } from './feed';
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

export const fetchRSS = ({url, lastModified, etag}) => {
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
  const httpResponse = await responsePromise;
  if (httpResponse.status !== 200) {
    console.log("Feed at " + feed.url + " not fetched.");
    console.log("Returned status code " +  httpResponse.status + ".")
    return feed;
  }
  if (yesterday() > feed.date) {
    feed.date = yesterday();
  }
  // HTMLRewriter outside of concurrent feed response leads to
  // overwriting and only the items of the first httpResponse
  // to arrivebeing kept.
  const rewriter = new HTMLRewriter();
  const dateHandler = new PubdateHandler(feed.date);
  const itemHandler = new ItemHandler(dateHandler);
  const truncatedResponse = rewriter
    .on('pubDate', dateHandler)
    .on('item', itemHandler)
    .transform(httpResponse);
  const rssString = await truncatedResponse.text();
  const fetchedFeed = await parser.parseString(rssString);
  return createFeed({
    _id: feed._id,
    $loki: feed.$loki,
    date: fetchedFeed.pubDate || fetchedFeed.lastBuildDate,
    etag: httpResponse.headers.etag,
    items: fetchedFeed.items,
    lastFetchedDate: new Date().getTime(),
    lastModified: httpResponse.headers["last-modified"],
    meta: feed.meta || {},
    title: fetchedFeed.title || feed.title,
    url: fetchedFeed.feedUrl || feed.url
  });
};
