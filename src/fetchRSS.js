import Parser from 'rss-parser';
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

const fetchRSS = ({url, lastModified, etag}) => {
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

export const parseFeed = async ({url, date}) => {
  console.time("fetching " + url);
  const httpResponse = await fetchRSS({url});
  console.timeEnd("fetching " + url);
  if (httpResponse.status !== 200) {
    console.log("Feed at " + url + " not fetched.");
    console.log("Returned status code " +  httpResponse.status + ".")
    return {url, date};
  }
  if (! date || yesterday() > date) {
    date = yesterday();
  }
  // HTMLRewriter outside of concurrent feed response leads to
  // overwriting and only the items of the first httpResponse
  // to arrivebeing kept.
  console.time("parsing " + url);
  const rewriter = new HTMLRewriter();
  const dateHandler = new PubdateHandler(date);
  const itemHandler = new ItemHandler(dateHandler);
  const truncatedResponse = rewriter
    .on('pubDate', dateHandler)
    .on('item', itemHandler)
    .transform(httpResponse);
  const rssString = await truncatedResponse.text();
  let fetchedFeed = await parser.parseString(rssString);
  fetchedFeed.etag = httpResponse.headers.etag;
  fetchedFeed.lastModified = httpResponse.headers["last-modified"];
  console.timeEnd("parsing " + url);
  return fetchedFeed;
};
