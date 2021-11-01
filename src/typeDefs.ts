import { gql } from 'apollo-server-cloudflare';
import { DocumentNode, GraphQLSchema } from 'graphql';

export const typeDefs: DocumentNode = gql`
  type Article {
    _id: String
    source: String
    date: Float
    image: String
    title: String
    link: String
    summary: String
    feedId: String
  }

  type Feed {
    _id: String
    title: String
    url: String
    date: Float
    count: Int
    lastFetchedDate: Float
  }

  type AddFeedResult {
    feed: Feed
    articles: [Article]!
  }

  type Query {
    articles(userId: String!): [Article]!
    feeds(userId: String!): [Feed]!
    feedIds(userId: String!): [String]!
    user(userId: String!): User
  }

  type Mutation {
    removeFeed(id: String!): Feed
    addFeed(url: String!): AddFeedResult!
    getNewArticles(userId: String!): [Article]!
    removeOldArticles: Int
    resetAllFeedDates: Boolean
  }

  type User {
    _id: String!
    feedList: [String]!
  }
`;
