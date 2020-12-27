import { gql } from 'apollo-server-cloudflare';

export const typeDefs = gql`
  type Article {
    id: String
    source: String
    date: Float
    title: String
    link: String
    summary: String
    feedId: String
  }

  type Feed {
    id: String
    title: String
    url: String
    date: Float
    count: Int
    lastFetchedDate: Float
  }

  type Query {
    articles(userId: String!): [Article]!
    feeds(userId: String!): [Feed]!
    feedIds(userId: String!): [String]
    user(userId: String!): User
  }

  type Mutation {
    removeFeed(id: String): Feed
    addFeed(id: String, url: String!): Feed
    getNewArticles(userId: String): [Article]
  }

  type User {
    id: String!
    feedList: [String]
  }
`;
