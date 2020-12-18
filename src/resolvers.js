import { articles, feeds } from './database';
import {
  addFeed,
  insertArticlesIfNew,
  updateLastFetchedDate
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
  console.log(JSON.stringify(result));
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
      let feed = addFeed({_id, url});
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
    feedList: ({_id}) => feeds.find().map(f => f._id),
    //feeds: ({_id}) => feedsFromUserId(_id),
    //feeds: ({feedList}) => feedLoader.loadMany(feedList),
    //articles: ({feedList}) => articlesFromFeedIds(feedList)
  },

  Query: {
    //articles: (parent, {userId}, context, info) => articlesLoader.load(userId),
    articles: (_, {userId}) => {
      console.time('articles query');
      const feedList = feeds.find().map(f => f._id);
      if (feedList.length === 0) {
        return [];
      }
      const result = articlesFromFeedIds(feedList);
      console.timeEnd('articles query');
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
