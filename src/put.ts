import { ICacheStats, IFlushArgs } from './interfaces'
import { isArray, isObject } from './util'

import CacheItem from './CacheItem'
import CacheMap from './CacheMap'
import { ICacheInstance } from './CacheInstance'
import { getCallStats } from './locate'
import { parse } from './parse'
import { preFlush } from './flush'
import { updatePointers } from './ref'

/**
 * Puts an item on the cache and updates all its references
 * to match any present in the item's entity tree.
 *
 * @param {Object|Object[]} entityOrArray object to be put into the context
 * @returns {ICacheStats} historyState object containing specific information
 *              about the cache node that has been created
 *              to store the items that were put.
 */
export const putItem = (entity: {} | Array<{}>, instance: ICacheInstance): ICacheStats => {
  // TODO ****** freeze arrays on put
  // only mergeThread entities with uid
  if ((isArray(entity) || isObject(entity))) {

    const evictMap: CacheMap<CacheItem> = new CacheMap<CacheItem>()
    const flushMap: CacheMap<CacheItem> = new CacheMap<CacheItem>()
    flushMap['__UPDATED__'] = false

    let flushArgs: IFlushArgs = {
      flushMap: flushMap,
      evictMap: evictMap,
      instance: instance,
    }

    // parse the object and collect all its uid
    // references in a flushMap
    parse(entity, flushArgs)

    // update all pointer references to the new objects
    updatePointers(flushArgs)

    if (flushArgs.flushMap.size() > 0) {
      preFlush(flushArgs, instance)
      return getCallStats(true, instance)
    }
  }
  return getCallStats(false, instance)
}
