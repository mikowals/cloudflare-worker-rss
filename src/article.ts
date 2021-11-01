import trimHTML from 'trim-html';
import sanitizeHtml from 'sanitize-html';
import { v4 as uuidv4 } from 'uuid';
import { assignIn, unescape, escape } from 'lodash';

interface ArticleInput {
  _id?: string,
  title?: string,
  author?: string,
  date?: number,
  image?: string,
  link?: string,
  media?: {'media:thumbnail': any},
  summary?: string,
  content?: string,
};

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
  }: ArticleInput, feed: any) {
    assignIn(this, {
      _id: _id || uuidv4(),
      title: unescape( title ),
      author,
      image: image || media && this.getImageFromMedia(media) || null,
      source: feed.title,
      feedId: feed._id,
      date: date && new Date(date).getTime(),
      link,
      summary: summary && escape(summary.replace(/(\r\n|\n|\r)/gm,"")),
    });
  }

  getImageFromMedia(media: {'media:thumbnail': [{'$': {'url': string}}]}) {
    const thumb: any = media['media:thumbnail'];
    return thumb && thumb[0] && thumb[0]['$'] && thumb[0]['$'].url;
  }
}