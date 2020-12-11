import loki from 'lokijs';
import { fetchArticles } from './fetch-articles';

var lokiDB = new loki('rss');
let articles = lokiDB.addCollection("articles", {
    unique: ['link'],
    indices: ['pubDate'],
});

addEventListener('fetch', event => {
  console.log(event.request.url);
  event.respondWith(handleRequest(event.request));
})

async function handleRequest(request) {
  if (! articles.findOne()) {
    let savedArticles = await RSS.get('articles', 'json');
    console.log("found ", savedArticles.length, " articles in Worker KV");
    //db.articles.insert(savedArticles);
    savedArticles.forEach(doc => {
      try {
        articles.insert(doc);
      } catch(err) {
        //console.log(err.message)
      }
    });
  }

  const url = new URL(request.url);
  switch (url.pathname) {
  case "/updateDB":
    const feedURLs = [
      "http://feeds.bbci.co.uk/news/education/rss.xml",
      "https://www.abc.net.au/news/feed/51120/rss.xml",
      "http://feeds.bbci.co.uk/news/world/rss.xml",
      "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
      "http://scripting.com/rss.xml"
    ];
    console.time("fetchArticles");
    const newArticles = await fetchArticles(feedURLs);
    let itemsInserted = 0;
    newArticles.forEach(article => {
      try {
        articles.insert(article);
        itemsInserted += 1;
      } catch(e) {}
    });

    console.timeEnd("fetchArticles")

    // insert async to KV to respond to user
    let kvInsert = RSS.put(
        "articles",
        JSON.stringify(articles.find()),
        {expirationTtl: 2 * 24 * 60 * 60} // expire in 2 days
    );

    return new Response("Inserted " +  itemsInserted + " new articles in database.", {
      headers: { 'content-type': 'text/plain' },
    });
    break;
  default:
    return new Response(
      JSON.stringify(articles
        .chain()
        .simplesort('pubDate', true)
        .limit(20)
        .data()), {
      headers: { 'content-type': 'text/plain' },
    })
  }
}
