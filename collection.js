import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

export class Collection {
  constructor({data = [], uniqueFields = ["_id"]}) {
    this.data = Array.isArray(data) ? data : [data];
    this.uniqueFields = Array.isArray(uniqueFields) ? uniqueFields : [uniqueFields];
  }

  find(target = {}, {fields = {}}) {
    let filtered = this.data;
    const pickKeys = _.keys(fields)
    if (! _.isEmpty(target)) {
      filtered = _.filter(filtered, _.matches(target));
    }
    return filtered.map((value) => _.pick(value, pickKeys))
  }

  findOne(target = {}, {fields = {}}) {
    return find(target, {fields})[0];
  }

  // Add rows to db.  Make sure all rows are unique where necessary
  // and have an _id.
  insert(newData) {
    if (! Array.isArray(newData))
      newData = [newData];
    newData = newData.map((obj) => {
      if ( "_id" in obj ) {
        return obj;
      }
      obj["_id"] = uuidv4();
      return obj;
    });
    const originalLength = this.data.length;
    this.data = [...this.data, ...newData];
    this.uniqueFields.forEach( field => {
      this.data = _.uniqBy(this.data, field);
    });
    return this.data.length - originalLength;
  }

  // Remove all objects that match all fields specified by target.
  remove(target) {
    if (_.isEmpty(target)) {
      const length = this.data.length;
      this.reset();
      return length;
    }
    const removed = _.remove(this.data, (value) => {
      for (const key of _.keys(target)) {
        if (target[key] !== value[key]) {
          return false;
        }
      }
      return true;
    });
    return removed.length;
  }

  reset() {
    this.data = [];
  }


}
