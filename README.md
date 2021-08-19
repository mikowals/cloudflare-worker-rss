# An RSS parsing backend to serve graphql requests.

Fast GraphQL backend to provide RSS data to subscribers. It uses Cloudflare's worker platform to handle requests and store data. Users receive browser responses in 30-70ms.

The code is running at https://worker-rss.mikowals.workers.dev/__graphql with a graphql gui to send requests and see responses.

You can download the code and run yourself with wrangler and a cloudflare account described below.
To generate using [wrangler](https://github.com/cloudflare/wrangler)

```
wrangler generate projectname https://github.com/cloudflare/worker-template
```

Further documentation for Wrangler can be found [here](https://developers.cloudflare.com/workers/tooling/wrangler).
