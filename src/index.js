import {
  articles,
  backupDb,
  feeds,
  users,
  loadDb,
  updateFeedsAndInsertArticles
} from './database';
import { handler as graphqlHandler } from './handlers/graphql';
import { handler as playgroundHandler } from './handlers/playground';
import { escape, some } from 'lodash';

const isMutation = async (request) => {
  const json = await request.json();
  if (! Array.isArray(json)) {
    json = [json]
  }
  if (some(json, j => j.query.slice(0,8) === 'mutation')) {
    return backupDb();
  }
  return true;
}

const htmlBoilerPlate = (body) => {
  return "<!doctype html>               \
  <html lang='en'>                      \
    <head>                              \
      <meta charset='utf-8'>            \
      <title>Simple RSS</title>         \
    </head>                             \
    <body>" + body + "</body> </html>";
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
})

async function handleRequest(event) {
  const { request } = event;
  await loadDb(event);
  const url = new URL(request.url);
  switch (url.pathname) {

  case "/graphql":
    console.time("graphQL request");
    const clone = await request.clone();
    let response =
      request.method === 'OPTIONS'
        ? new Response(null, { status: 204 })
        : await graphqlHandler(request);
    console.timeEnd("graphQL request");
    event.waitUntil(isMutation(clone));
    response = setCorsHeaders(response, request.headers.get('origin'));
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


const setCorsHeaders = (response, origin, config=true) => {
  const allowedOrigins = [
    "127.0.0.1:8787",
    "127.0.0.1:3000",
    ".simple-rss-next.pages.dev",
    ".mikowals.workers.dev"
  ]
  let allowedOrigin = ""
  if (some(allowedOrigins, o => origin.includes(o))) {
    allowedOrigin = origin
  }

  const corsConfig = config instanceof Object ? config : false
  response.headers.set(
    'Access-Control-Allow-Credentials',
    corsConfig ? corsConfig.allowCredentials : 'true',
  )
  response.headers.set(
    'Access-Control-Allow-Headers',
    corsConfig ? corsConfig.allowHeaders : 'Content-Type',
  )
  response.headers.set(
    'Access-Control-Allow-Methods',
    corsConfig ? corsConfig.allowMethods : 'GET, POST, OPTIONS',
  )
  response.headers.set(
    'Access-Control-Allow-Origin',
    corsConfig ? corsConfig.allowOrigin : allowedOrigin,
  )
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response;
}
