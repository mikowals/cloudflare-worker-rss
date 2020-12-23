const { ApolloServer } = require('apollo-server-cloudflare')
const { graphqlCloudflare } = require('apollo-server-cloudflare/dist/cloudflareApollo')
import { resolvers } from '../resolvers';
import { typeDefs } from '../typeDefs';

const createServer = () =>
  new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true
  })

export const handler = (request) => {
  const server = createServer()
  return graphqlCloudflare(() => server.createGraphQLServerOptions(request))(request);
  response.headers.set('Cache-Control','max-age=0');
  return response
}
