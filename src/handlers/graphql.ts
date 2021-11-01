import { ApolloServer, GraphQLOptions } from 'apollo-server-cloudflare';
import { graphqlCloudflare } from 'apollo-server-cloudflare/dist/cloudflareApollo';
import { resolvers } from '../resolvers';
import { typeDefs } from '../typeDefs';

const createServer = () =>
  new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true
  })

export const handler = async (request: Request): Promise<Response> => {
  const server = createServer();
  server.start();
  const options: GraphQLOptions = await server.createGraphQLServerOptions(request);
  return graphqlCloudflare(options)(request) as Promise<Response>;
}
