import Parser from 'rss-parser';
import { yesterday } from './utils';

export const fetchRSS = async ({url}: {url: string}) => {
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
  return await parseFeed(httpResponse, yesterday());
};

const parseFeed = async (httpResponse: Response, limitDate: number) => {
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
  keepLimitDate: number;
  dropItems: boolean;
  dateText: string;

  constructor(limitDate: number, dropItems?: boolean) {
    this.keepLimitDate = limitDate;
    this.dropItems = !!dropItems;
    this.dateText = '';
  }

  text(text: Text) {
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
  dropItems: () => boolean;
  dropped: number;
  kept: number;

  constructor(pubdateHandler: PubdateHandler) {
    this.dropItems = () => pubdateHandler.dropItems;
    this.dropped = 0;
    this.kept = 0;
  }

  element(item: Element) {
    if (this.dropItems()) {
      item.remove();
      this.dropped++;
    } else {
      this.kept++;
    }
  }
}
