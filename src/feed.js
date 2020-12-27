import { v4 as uuidv4 } from 'uuid';

export class Feed {
  constructor({
    _id,
    date,
    etag,
    items,
    lastFetchedDate,
    lastModified,
    pubDate,
    subscribers,
    title,
    url
  }, {keepItems}) {
    this._id = _id || uuidv4();
    this.date = new Date(date || pubDate || 0).getTime();
    this.etag = etag;
    this.items = keepItems ? items || [] : undefined;
    this.lastFetchedDate = new Date(lastFetchedDate || 0).getTime();
    this.lastModified = lastModified;
    this.subscribers = subscribers || ["nullUser"];
    this.title = title
    this.url = url;
  }
}
