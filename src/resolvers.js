import { articles, feeds, users } from './database';
import { Feed } from './feed';
import { countLoader } from './loaders';
import { yesterday } from './utils'
import { pick } from 'lodash';

const articlesFromFeedIds = (feedIds) => {
  const result = articles
    .chain()
    .find({'feedId': {'$in': feedIds}})
    .simplesort('date', true)
    .limit(40)
    .data();

  return result.map( article => pick(article, [
    '_id',
    'date',
    'feedId',
    'image',
    'link',
    'source',
    'summary',
    'title',
    ]));
}

const feedsFromUserId = (userId) => {
  const result = feeds.find();
  return result.map(feed => pick(feed, ['_id', 'title', 'url', 'date']));
}

const updateFeeds = async (targetFeeds) => {
  let insertedArticles = await Promise.all(
    targetFeeds.map(async feed => {
      const fetchedFeed = await Feed.fetch(feed);
      return Feed.update(fetchedFeed);
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

    addFeed: async (parent, {url}, context, info) => {
      let existingFeed = feeds.by('url', url)
      if (existingFeed) {
        return existingFeed;
      }
      const newFeed = Feed.createFromURL(url)
      return newFeed
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
        .limit(4)
        .data();

      return await updateFeeds(userFeeds);
    },

    removeOldArticles() {
      const originalArticleCount = articles.count();
      articles.chain().find({date: {"$jlt": yesterday()}}).remove();
      return originalArticleCount - articles.count();
    },

    resetAllFeedDates() {
      const newDate = yesterday();
      feeds.find().forEach(feed => {
        feed.date = newDate;
        Feed.update(feed);
      });
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
