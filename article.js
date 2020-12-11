import cheerio from 'cheerio';
import trimHTML from 'trim-html';
import assignIn from 'lodash.assignin';
import unescape from 'lodash.unescape';
import sanitizeHtml from 'sanitize-html';

export class Article {
  constructor({
    title,
    author,
    date,
    link,
    summary,
    content
  } = {}, feed = {}) {
    assignIn(this, {
      title: unescape( title ),
      author,
      source: feed.title || null,
      feedId: feed._id || null,
      date: new Date(date),
      link,
    });

    this.setSummary(summary || content);

    if ( Object.prototype.toString.call(date) === "[object Date]" &&
      ! isNaN(date) && date.getTime() < this.date.getTime()) {
        this.date = date;
    }
  }

  setSummary(summary) {
    this.summary = summary && cleanSummary( summary );
  }

}

function cleanSummary (text) {
  var $ = cheerio.load(text);  //relies on cheerio package

  $('img').remove();
  $('table').remove();
  $('script').remove();
  $('iframe').remove();
  $('.feedflare').remove();

  if( $('p').length )
  {
    text = $('p').eq(0).html() + ( $('p').eq(1).html() || '');
  }
  else if( $('li').length ){
    text = '<ul>';
    $('ul li').slice(0,6).each( function(){
  text += "<li>" + $(this).html() + "</li>";
  });
    text += "</ul>";
  }

  else{
    if ( $.html() ){
      text = $.html();
    }

    if ( text.indexOf('<br') !== -1 ){
      text = text.substring(0, text.indexOf('<br'));
    }

    text = trimHTML(text, {limit: 500}).html;
  }

  if (text === null || text === undefined || text === "null") {
    text = '';
  }
  return sanitizeHtml(text);
}
