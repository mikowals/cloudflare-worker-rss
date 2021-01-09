import { articles, feeds, users } from './database';
import { Feed } from './feed';
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

const updateFeeds = async (targetFeeds) => {
  let insertedArticles = await Promise.all(
    targetFeeds.map(async feed => {
      await Feed.fetch(feed);
      return Feed.update(feed);
    })
  );
  return insertedArticles.flat();
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
      let user = users.by("_id", "nullUser")
      let idx = user.feedList.indexOf(null);
      user.feedList = user.feedList.splice(idx, 1);
      users.update(user);
      return {_id: id};
    },

    addFeed: async (parent, {_id, url}, context, info) => {
      let existingFeed = feed.by('url', url)
      if (existingFeed) {
        return existingFeed;
      }
      let feed = Feed.maybeAddId({_id, url});
      await Feed.fetch(feed);
      return Feed.insert(feed);;
    },

    getNewArticles: async (parent, {userId}) => {
      const user = users.by("_id", userId || "nullUser");
      if (! user) {
        return [];
      }
      const userFeeds = feeds
        .chain()
        .find({'_id': { '$in' : user.feedList}})
        .simplesort('lastFetchedDate')
        .limit(2)
        .data();

      return await updateFeeds(userFeeds);
    },

    removeOldArticles() {
      const originalArticleCount = articles.count();
      articles.chain().find({date: {"$jlt": yesterday()}}).remove();
      return originalArticleCount - articles.count();
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
      const user = users.by("_id", "nullUser");
      const feedList = (user && user.feedList) || feeds.find().map(f => f._id);
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
