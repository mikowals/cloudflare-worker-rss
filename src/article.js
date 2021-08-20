import trimHTML from 'trim-html';
import sanitizeHtml from 'sanitize-html';
import { v4 as uuidv4 } from 'uuid';
import { assignIn, unescape, escape } from 'lodash';
const util = require('util')

export class Article {
  constructor({
    _id,
    title,
    author,
    date,
    image,
    link,
    media,
    summary,
    content
  } = {}, feed = {}) {
    assignIn(this, {
      _id: _id || uuidv4(),
      title: unescape( title ),
      author,
      image: image || media && this.getImageFromMedia(media) || null,
      source: feed.title || null,
      feedId: feed._id || null,
      date: new Date(date).getTime(),
      link,
    });

    this.setSummary(summary || content);

    if ( Object.prototype.toString.call(date) === "[object Date]" &&
      ! isNaN(date) && date.getTime() < this.date) {
        this.date = date.getTime();
    }
  }

  setSummary(summary) {
    this.summary = summary && escape(summary.replace(/(\r\n|\n|\r)/gm,""));
  }

  getImageFromMedia(media) {
    console.log("media: ", media);
    const thumb = media['media:thumbnail'];
    return thumb && thumb[0] && thumb[0]['$'] && thumb[0]['$'].url;
  }
}