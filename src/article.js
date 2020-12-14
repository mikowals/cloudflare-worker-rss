import trimHTML from 'trim-html';
import assignIn from 'lodash.assignin';
import unescape from 'lodash.unescape';
import escape from 'lodash.escape';
import sanitizeHtml from 'sanitize-html';
import { v4 as uuidv4 } from 'uuid';

class ElementRemover {
  element(element) {
    element.remove();
  }
}

class ElementTagRemover {
  element(element) {
    element.removeAndKeepContent();
  }
}

let htmlRewriter = new HTMLRewriter()
    .on("img", new ElementRemover())
    .on("table", new ElementRemover())
    .on("script", new ElementRemover())
    .on("iframe", new ElementRemover())
    .on(".feedflare", new ElementRemover())
    .on("div", new ElementTagRemover());

export class Article {
  constructor({
    _id,
    title,
    author,
    date,
    link,
    summary,
    content
  } = {}, feed = {}) {
    assignIn(this, {
      _id: _id || uuidv4(),
      title: unescape( title ),
      author,
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

}
