import { articles, feeds } from './database';
import {
  insertNewFeedWithArticles,
  updateFeedsAndInsertArticles
} from './database';
import pick from 'lodash.pick';
import { countLoader } from './loaders';
import { yesterday } from './utils'

const articlesFromFeedIds = (feedIds) => {
  const result = articles
    .chain()
    .find({'feedId': {'$in': feedIds}})
    .simplesort('date', true)
    .limit(40)
    .data();

  return result.map( article => pick(article, [
    '_id',
    'title',
    'source',
    'link',
    'date',
    'summary',
    'feedId']));
}

const feedsFromUserId = (userId) => {
  const result = feeds.find();
  return result.map(feed => pick(feed, ['_id', 'title', 'url', 'date']));
}

export const resolvers = {
  Feed: {
    count: ({_id}) => countLoader.load(_id)
  },

  Mutation: {
    // Rewrite so that feed is only removed per user
    removeFeed(parent, {id}, context, info) {
      articles.findAndRemove({feedId: id});
      feeds.findAndRemove({_id: id});
      return {_id: id};
    },

    addFeed(parent, {_id, url}, context, info) {
      let feed = insertNewFeedWithArticles({_id, url});
      return feed;
    },

    getNewArticles: async (parent, {userId}) => {
      const userFeeds = feeds
        .chain()
        .find({'subscribers': { '$contains' : "nullUser"}})
        .simplesort('lastFetchedDate')
        .limit(2)
        .data();

      return await updateFeedsAndInsertArticles(userFeeds);
    },
    removeOldArticles() {
      articles.chain().find({date: {"$jlt": yesterday()}}).remove();
      return true;
    }
  },

  User: {
    feedList: ({_id}) => feeds.find().map(f => f._id),
    //feeds: ({_id}) => feedsFromUserId(_id),
    //feeds: ({feedList}) => feedLoader.loadMany(feedList),
    //articles: ({feedList}) => articlesFromFeedIds(feedList)
  },

  Query: {
    //articles: (parent, {userId}, context, info) => articlesLoader.load(userId),
    articles: (_, {userId}) => {
      const feedList = feeds.find().map(f => f._id);
      if (feedList.length === 0) {
        return [];
      }
      const result = articlesFromFeedIds(feedList);
      return result
    },

    feedIds: (_, {userId}) => feeds.find().map(f => f._id),
    feeds: (_, {userId}) => feeds.find().map(f => {
      return pick(f, ['_id', 'title', 'url', 'date', 'lastFetchedDate'])
    }),
    //feeds: (_, {userId}) => feedLoader.load(userId),
    user: (_, {userId}) => {
      return {_id: "nullUser", feedList: feeds.find().map(f => f._id)}
    }
  },
};
