import DataLoader from 'dataloader';
import { articles, feeds } from './database';
import groupBy from 'lodash.groupby';

export const countLoader = new DataLoader(async (keys) => {
  countLoader.clearAll();

  const groupedArticles = groupBy(articles.find({feedId: {$in: keys}}), 'feedId')
  return keys.map(key => {
    const group = groupedArticles[key];
    return group ? group.length : 0;
  })
}, {
  batchScheduleFn: callback => setTimeout(callback, 1)
});
