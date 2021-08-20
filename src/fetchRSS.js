import Parser from 'rss-parser';
import { yesterday } from './utils';
import { isEmpty } from 'lodash';

export const fetchRSS = async ({url}) => {
  const httpResponse = await fetch(new Request(url),{
    cf: {
      cacheEverything: true,
      cacheTtlByStatus: {'200-299': 600, 404: 1, '500-599': 0}
    }
  });
  if (httpResponse.status !== 200) {
    console.log("Feed at " + url + " not fetched.");
    console.log("Returned status code " +  httpResponse.status + ".")
    return {url};
  }
  return await parseFeed(httpResponse, yesterday())
}

const parseFeed = async (httpResponse, limitDate) => {
  // HTMLRewriter outside of concurrent feed response leads to
  // overwriting and only the items of the first httpResponse
  // to arrive are kept.
  const rewriter = new HTMLRewriter();
  const dateHandler = new PubdateHandler(limitDate);
  const itemHandler = new ItemHandler(dateHandler);
  const truncatedResponse = rewriter
    .on('pubDate', dateHandler)
    .on('item', itemHandler)
    .transform(httpResponse);
  const rssString = await truncatedResponse.text();
  let fetchedFeed = await parser.parseString(rssString);
  return fetchedFeed;
};

const parser = new Parser({
  customFields: {
    item: [
      ['author', 'author'],
      ['description', 'summary'],
      ['pubDate', 'date'],
      ['media:group', 'media'],
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
    console.log(
      "PubdateHandler - ",
      id,
      " kept: ",
      this.kept,
      " dropped: ",
      this.dropped
    )
  }
}
