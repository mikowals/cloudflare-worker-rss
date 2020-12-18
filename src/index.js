import { fetchArticles } from './fetch-articles';
import {
  articles,
  feeds,
  users,
  maybeLoadDb,
  insertArticlesIfNew,
  updateLastFetchedDate
} from './database';
import escape from 'lodash.escape';
import { handler as graphqlHandler } from './handlers/graphql';
import { handler as playgroundHandler } from './handlers/playground';


const htmlBoilerPlate = (text) => {
  return "<!doctype html>                       \
          <html lang='en'>                      \
            <head>                              \
            <meta charset='utf-8'>              \
            <title>Simple RSS</title>           \
            </head>                             \
            <body>" + text +
            "</body>                            \
            </html>";
}
addEventListener('fetch', event => {
  console.log(event.request.url);
  event.respondWith(handleRequest(event));
})

async function handleRequest({request, waitUntil}) {
  await maybeLoadDb();
  const url = new URL(request.url);
  switch (url.pathname) {

  case "/pollFeeds":
    console.time("fetchArticles");
    const feedsForUpdate = feeds
      .chain()
      .simplesort('lastFetchedDate')
      .limit(5)
      .data();
    const newArticles = await fetchArticles(feedsForUpdate);
    updateLastFetchedDate(feedsForUpdate);
    let itemsInserted = await insertArticlesIfNew(newArticles);
    console.timeEnd("fetchArticles");
    return new Response(
      htmlBoilerPlate(
        "Inserted " +  itemsInserted.length + " new articles in database.\n" +
        JSON.stringify({summary: "<a href='http://scripting.com'>test</a>"})
      ), {
        headers: { 'content-type': 'text/html' },
    });

  case "/graphql":
    const response =
      request.method === 'OPTIONS'
        ? new Response('', { status: 204 })
        : await graphqlHandler(request);
    return setCorsHeaders(response);

  case "/__graphql":
      return playgroundHandler(request, {baseEndpoint: '/graphql'});

  default:
    return new Response(htmlBoilerPlate(
      JSON.stringify(
        articles.chain().simplesort("date", true).limit(80).data()
      )), {
      headers: { 'content-type': 'text/html' },
    });
  }
}


const setCorsHeaders = (response, config=true) => {
  const corsConfig = config instanceof Object ? config : false

  response.headers.set(
    'Access-Control-Allow-Credentials',
    corsConfig ? corsConfig.allowCredentials : 'true',
  )
  response.headers.set(
    'Access-Control-Allow-Headers',
    corsConfig ? corsConfig.allowHeaders : 'application/json, Content-type',
  )
  response.headers.set(
    'Access-Control-Allow-Methods',
    corsConfig ? corsConfig.allowMethods : 'GET, POST',
  )
  response.headers.set('Access-Control-Allow-Origin', corsConfig ? corsConfig.allowOrigin : '*')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response;
}
