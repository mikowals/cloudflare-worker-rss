import { articles, feeds } from './database';
import {
  insertNewFeedWithArticles,
  insertArticlesIfNew,
  updateLastFetchedDate,
  fetchArticlesByFeedIds,
} from './database';
import pick from 'lodash.pick';
import { countLoader } from './loaders';
import { fetchArticles } from './fetch-articles';

const articlesFromFeedIds = (feedIds) => {
  const result = articles
    .chain()
    .find({'feedId': {'$in': feedIds}})
    .simplesort('date', true)
    .limit(40)
    .data();

  return result.map( article => pick(article, [
    'id',
    'title',
    'source',
    'link',
    'date',
    'summary',
    'feedId']));
}

const feedsFromUserId = (userId) => {
  const result = feeds.find();
  return result.map(feed => pick(feed, ['id', 'title', 'url', 'date']));
}

export const resolvers = {
  Feed: {
    count: ({id}) => countLoader.load(id)
  },

  Mutation: {
    // Rewrite so that feed is only removed per user
    removeFeed(parent, {id}, context, info) {
      articles.findAndRemove({feedId: id});
      feeds.findAndRemove({id: id});
      return {id: id};
    },

    addFeed(parent, {id, url}, context, info) {
      let feed = insertNewFeedWithArticles({id, url});
      return feed;
    },

    getNewArticles: async (parent, {userId}) => {
      const userFeeds = feeds.find({'subscribers': { '$contains' : "nullUser"}});
      const newArticles = await fetchArticles(userFeeds);
      updateLastFetchedDate(userFeeds);
      return insertArticlesIfNew(newArticles);
    }
  },

  User: {
    feedList: ({id}) => feeds.find().map(f => f.id),
    //feeds: ({id}) => feedsFromUserId(id),
    //feeds: ({feedList}) => feedLoader.loadMany(feedList),
    //articles: ({feedList}) => articlesFromFeedIds(feedList)
  },

  Query: {
    //articles: (parent, {userId}, context, info) => articlesLoader.load(userId),
    articles: async (_, {userId}) => {
      const feedList = feeds.find().map(f => f.id);
      if (feedList.length === 0) {
        return [];
      }
      console.time("fetchArticles");
      const result = await fetchArticlesByFeedIds(feedList);
      console.timeEnd("fetchArticles");
      return result;
    },

    feedIds: (_, {userId}) => feeds.find().map(f => f.id),
    feeds: (_, {userId}) => feeds.find().map(f => {
      return pick(f, ['id', 'title', 'url', 'date', 'lastFetchedDate'])
    }),
    //feeds: (_, {userId}) => feedLoader.load(userId),
    user: (_, {userId}) => {
      return {id: "nullUser", feedList: feeds.find().map(f => f.id)}
    }
  },
};
