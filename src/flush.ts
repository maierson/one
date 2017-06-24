import CacheItem from './CacheItem'
import CacheMap from './CacheMap'
import { ICacheInstance } from './CacheInstance'
import { IFlushArgs } from './interfaces'
import { config } from './cache'
import { getCacheCurrentStack } from './cacheUtil'
import { getNewCacheNode } from './util'

const freezeItem = (item: CacheItem) => {
  Object.freeze(item)
  Object.freeze(item.entity)
  Object.freeze(item.mapTo)
  Object.freeze(item.mapFrom)
}

/**
   * The cache might have a series of intermediary steps
   * that do not need to be persisted to the nodes. Flush
   * pushes the current state into the nodes when all
   * atomic changes for a single merge have happened.
   *
   * @param temp
   * @param threadIds
   */
export const flush = (temp: CacheMap<CacheItem>, instance: ICacheInstance) => {
  if (temp !== null) {
    Object.freeze(temp)
    let cacheNode = getNewCacheNode(instance)
    cacheNode.items = temp

    if (instance.thread.nodes.indexOf(cacheNode.id) < 0) {
      instance.thread.nodes.push(cacheNode.id)
      instance.thread.current += 1
    }
  }
}

/**
 * For items that are unique in context all references on the map
 * must point to the same single object.
 *
 * In order to prevent the map from replicating itself
 * on each put operation this must be executed with mutations
 * thus adding all items on the same mutating instance of the map.
 *
 * All items to be added must have been previously collected in the flushMap.
 *
 * @param flushArgs config object
 * @param instance the current instance of the cache
 */
export const preFlush = (flushArgs: IFlushArgs, instance: ICacheInstance) => {
  // get a copy of the current nodes
  let temp = new CacheMap<CacheItem>()

  let currentStack: CacheMap<CacheItem> = getCacheCurrentStack(instance)
  if (currentStack) {
    currentStack.forEach((key, item: CacheItem) => {
      temp.set(key, item)
    })
  }

  flushArgs.flushMap.forEach((key, item: CacheItem) => {
    // track the uid of the item being changed and referencing the items.
    let itemUid = item.entity[config.uidName]
    freezeItem(item)
    temp.set(String(itemUid), item)
  })

  if (flushArgs.evictMap.size() > 0) {
    flushArgs.evictMap.forEach((key, value) => {
      temp.delete(String(key))
    })
  }

  flush(temp, instance)
}
