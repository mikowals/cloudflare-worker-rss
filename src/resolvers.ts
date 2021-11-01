import { articles, feeds, users } from './database';
import { Feed } from './feed';
import { countLoader } from './loaders';
import { yesterday } from './utils'
import { pick } from 'lodash';

const articlesFromFeedIds = (feedIds: string[]) => {
  const result = articles
    .chain()
    .find({'feedId': {'$in': feedIds}})
    .simplesort('date', true)
    .limit(40)
    .data();

  return result.map( (article: any) => pick(article, [
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

const feedsFromUserId = (userId: string) => {
  const result = feeds.find();
  return result.map((feed: any) => pick(feed, ['_id', 'title', 'url', 'date']));
}

const updateFeeds = async (targetFeeds: any) => {
  let insertedArticles = await Promise.all(
    targetFeeds.map(async (feed: any) => {
      const fetchedFeed = await Feed.fetch(feed);
      return Feed.update(fetchedFeed);
    })
  );
  return insertedArticles.flat();
}

export const resolvers = {
  Feed: {
    count: ({_id}: {_id: string}) => countLoader.load(_id)
  },

  Mutation: {
    // Rewrite so that feed is only removed per user
    removeFeed(parent: any, {id} : {id: any}, context: any, info: any) {
      articles.findAndRemove({feedId: id});
      feeds.findAndRemove({_id: id});
      let user = users.by("_id", "nullUser")
      let idx = user.feedList.indexOf(null);
      user.feedList = user.feedList.splice(idx, 1);
      users.update(user);
      return {_id: id};
    },

    addFeed: async (parent: any, {url}: any, context: any, info: any) => {
      let existingFeed = feeds.by('url', url)
      if (existingFeed) {
        return {
          feed: existingFeed,
          articles: articlesFromFeedIds([existingFeed._id])
        };
      }
      return Feed.createFromURL(url);
    },

    getNewArticles: async (parent: any, {userId}: {userId: string}) => {
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
      feeds.find().forEach((feed: any) => {
        feed.date = newDate;
        Feed.update(feed);
      });
      return true;
    }
  },

  User: {
    feedList: ({_id}: {_id: string}) => feeds.find().map((f: {_id: string}) => f._id),
    //feeds: ({_id}) => feedsFromUserId(_id),
    //feeds: ({feedList}) => feedLoader.loadMany(feedList),
    //articles: ({feedList}) => articlesFromFeedIds(feedList)
  },

  Query: {
    //articles: (parent, {userId}, context, info) => articlesLoader.load(userId),
    articles: (_: any, {userId}: {userId: string}) => {
      const user = users.by("_id", "nullUser");
      const feedList = (user && user.feedList) || feeds.find().map((f: {_id: string}) => f._id);
      if (feedList.length === 0) {
        return [];
      }
      return articlesFromFeedIds(feedList); 
    },

    feedIds: (_: any, {userId}: {userId: string}) => feeds.find().map((f: {_id: string}) => f._id),
    feeds: (_: any, {userId}: {userId: string}) => feeds.find().map((f: any) => {
      return pick(f, ['_id', 'title', 'url', 'date', 'lastFetchedDate'])
    }),
    //feeds: (_, {userId}) => feedLoader.load(userId),
    user: (_: any, {userId}: {userId: string}) => {
      return {_id: "nullUser", feedList: feeds.find().map((f: {_id: string}) => f._id)}
    }
  },
};
