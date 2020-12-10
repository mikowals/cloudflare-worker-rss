import { Collection } from './collection';
import loki from 'lokijs';
import { fetchArticles } from './fetch-articles';
var db = {
  articles: new Collection({uniqueFields: ["link"]}),
  feeds: new Collection({uniqueFields: ["url"]})
};

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
    let itemsInserted = db.articles.insert(newArticles);
    console.timeEnd("fetchArticles")
    let kvInsert = await RSS.put(
        "articles",
        JSON.stringify(db.articles.find({}, {
          fields: {
            _id: 1,
            link: 1,
            title: 1,
            pubDate: 1,
            contentSnippet: 1,
            guid: 1
          }
        })),
        {expirationTtl: 2 * 24 * 60 * 60} // expire in 2 days
    );

    return new Response("Inserted " +  itemsInserted + " new articles.", {
      headers: { 'content-type': 'text/plain' },
    });
    break;
  default:
    let savedArticles = await RSS.get('articles', 'json');
    console.log("found ", savedArticles.length, " articles");
    //db.articles.insert(savedArticles);
    savedArticles.forEach(doc => {
      try {
        articles.insert(doc);
      } catch(err) {
        //console.log(err.message)
      }
    });
    
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
