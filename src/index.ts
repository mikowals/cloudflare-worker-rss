import {
  articles,
  backupDb,
  feeds,
  loadDb,
} from './database';
import { handler as graphqlHandler } from './handlers/graphql';
import { handler as playgroundHandler } from './handlers/playground';
import { escape, some } from 'lodash';

const isMutation = async (request: Request) => {
  const json = await request.json();
  let needsBackup = null;
  if (Array.isArray(json)) {
    needsBackup = some(json, j => j.query.slice(0,8) === 'mutation')
  } else {
    needsBackup = json.query.slice(0,8) === 'mutation';
  }

  if (needsBackup) {
    return backupDb();
  }

  return true;
}

const htmlBoilerPlate = (body: string) => {
  return "<!doctype html>               \
  <html lang='en'>                      \
    <head>                              \
      <meta charset='utf-8'>            \
      <title>Simple RSS</title>         \
    </head>                             \
    <body>" + body + "</body> </html>";
}

addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(handleRequest(event));
})

async function handleRequest(event: FetchEvent): Promise<Response> {
  const { request } = event;
  await loadDb(event);
  const url = new URL(request.url);
  switch (url.pathname) {

  case "/graphql":
    console.time("graphQL request");
    const clone = request.clone();
    let response: Response =
      request.method === 'OPTIONS'
        ? new Response(null, { status: 204 })
        : await graphqlHandler(request);
    console.timeEnd("graphQL request");
    event.waitUntil(isMutation(clone));
    response = setCorsHeaders(response, request.headers.get('origin') || '');
    return response;

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


const setCorsHeaders = (
  response: any, 
  origin: string, 
  config?: {
    allowCredentials?: string,
    allowHeaders?: string,
    allowMethods?: string,
    allowOrigin?: string,
  }) => {
  const allowedOrigins = [
    "127.0.0.1:8787",
    "127.0.0.1:3000",
    "127.0.0.1",
    "localhost",
    "simple-rss-next.pages.dev",
    ".mikowals.workers.dev"
  ]
  let allowedOrigin = '';
  if (! origin || some(allowedOrigins, o => origin.includes(o))) {
    allowedOrigin = origin
  }

  response.headers.set(
    'Access-Control-Allow-Credentials',
    config && config.allowCredentials || 'true',
  )
  response.headers.set(
    'Access-Control-Allow-Headers',
    config && config.allowHeaders || 'Content-Type',
  )
  response.headers.set(
    'Access-Control-Allow-Methods',
    config && config.allowMethods || 'GET, POST, OPTIONS',
  )
  response.headers.set(
    'Access-Control-Allow-Origin',
    config && config.allowOrigin || allowedOrigin,
  )
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response;
}
