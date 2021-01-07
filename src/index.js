import {
  articles,
  backupDb,
  feeds,
  users,
  maybeLoadDb,
  updateFeedsAndInsertArticles
} from './database';
import escape from 'lodash.escape';
import { handler as graphqlHandler } from './handlers/graphql';
import { handler as playgroundHandler } from './handlers/playground';

const isMutation = async (request) => {
  const json = await request.json();
  if (json.query.slice(0,8) === 'mutation') {
    return backupDb();
  }
  return true;
}

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

async function handleRequest(event) {
  const { request } = event;
  console.time("loadDBfromKV")
  await maybeLoadDb(event);
  console.timeEnd("loadDBfromKV")
  const url = new URL(request.url);
  switch (url.pathname) {

  case "/pollFeeds":
    console.time("fetchArticles");
    const feedsForUpdate = feeds
      .chain()
      .simplesort('lastFetchedDate')
      .limit(5)
      .data();
    let itemsInserted = await updateFeedsAndInsertArticles(feedsForUpdate);
    event.waitUntil(backupDb());
    console.timeEnd("fetchArticles");
    return new Response(
      htmlBoilerPlate(
        "Inserted " +  itemsInserted.length + " new articles in database.\n" +
        JSON.stringify({summary: "<a href='http://scripting.com'>test</a>"})
      ), {
        headers: { 'content-type': 'text/html' },
    });

  case "/graphql":
    console.time("graphQL request");
    const clone = await request.clone();
    let response =
      request.method === 'OPTIONS'
        ? new Response('', { status: 204 })
        : await graphqlHandler(request);
    console.timeEnd("graphQL request");
    event.waitUntil(isMutation(clone));
    response = setCorsHeaders(response);
    return response

  case "/__graphql":
    return playgroundHandler(request, {baseEndpoint: '/graphql'});

  case "/feeds":
    return new Response(
      htmlBoilerPlate(
        JSON.stringify(
          feeds.find()
        )
      ), {
        headers: { 'content-type': 'text/html' },
      }
    );

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
