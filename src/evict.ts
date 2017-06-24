import * as opath from './path'

import { ICacheStats, IFlushArgs } from './interfaces'
import { cacheSize, hasUid, isArray, isObject } from './util'
import { getCacheCurrentStack, getCachedItem, getItemFlushOrCached } from './cacheUtil'
import { updatePointers, updateRefFroms } from './ref'

import CacheItem from './CacheItem'
import CacheMap from './CacheMap'
import { ICacheInstance } from './CacheInstance'
import { config } from './cache'
import { flush } from './flush'
import { getCallStats } from './locate'
import { getEditItem } from './get'
import { parse } from './parse'

/**
 *
 * @param obj
 * @returns {*}
 */
const buildEvictUidArray = obj => {
  let uidArray = []
  if (isArray(obj)) {
    // array - check if we have uids or strings
    obj.forEach(item => {
      if (hasUid(item)) {
        uidArray.push(String(item[config.uidName]))
      } else {
        if (typeof item === 'string' || typeof item === 'number') {
          uidArray.push(String(item))
        }
        // else nothing - skip it
      }
    })
  } else {
    let uid = obj
    if (isObject(obj)) {
      uid = obj[config.uidName]
    }
    if (uid === undefined) {
      return uidArray
    }
    uidArray.push(String(uid))
  }
  return uidArray
}

/**
 *
 * @param {Object|string|Object[]|string[]}obj Either a single entity or its uid or an array of
 *     entities or an array of uids (cannot mix entities with uids)
 * @return {ICacheStats} cache statistics.
 */
export const evictItem = (obj, instance: ICacheInstance): ICacheStats => {

  let uidArray = buildEvictUidArray(obj)

  if (uidArray.length == 0) {
    return getCallStats(false, instance)
  }
  let currentState = getCacheCurrentStack(instance)
  let found = uidArray.some(item => {
    return currentState && currentState.has(String(item))
  })

  if (!found) {
    return getCallStats(false, instance)
  }

  let tempState = new CacheMap<CacheItem>()
  currentState.forEach((key, value: CacheItem) => {
    tempState.set(key, value)
  })

  let flushMap = new CacheMap<CacheItem>()
  let evictMap = new CacheMap<CacheItem>()

  let flushArgs: IFlushArgs = {
    flushMap: flushMap,
    evictMap: evictMap,
    instance: instance
  }

  let parentsChanged = []

  uidArray.forEach(uid => {

    // remove refFrom in item references metadata
    clearTargetRefFroms(uid, flushArgs)

    // value doesn't matter here - will be evicted
    evictMap.set(uid, null)

    // remove refTo in parent metadata
    clearParentRefTos(uid, uidArray, parentsChanged, flushArgs)
  })

  putParentsChanged(parentsChanged, flushMap, evictMap, instance)

  // updates
  flushMap.forEach((key, item: CacheItem) => {
    tempState.set(key, item)
  })

  // evicts
  evictMap.forEach((key, item: CacheItem) => {
    tempState.delete(key)
  })

  flush(tempState, instance)

  return getCallStats(true, instance)
}

/**
 * Updates an entire collection of parents that may have been
 * updated as a result of their inner references being changed.
 */
const putParentsChanged = (parentsChanged: Array<any>, flushMap: CacheMap<CacheItem>,
  evictMap: CacheMap<CacheItem>, instance: ICacheInstance) => {
  if (parentsChanged && parentsChanged.length > 0 && cacheSize(instance) > 0) {
    let flushArgs: IFlushArgs = {
      flushMap: flushMap,
      evictMap: evictMap,
      instance: instance
    }
    parse(parentsChanged, flushArgs)
    // refTos have been updated already only handle refFroms
    flushArgs.flushMap.forEach((key, item: CacheItem) => {
      // do not modify flush map on its own iteration
      // but ok to pass along for reference
      updateRefFroms(item, flushArgs)
    })
  }
}

/**
 * Clears all references from a specific parent when it is being evicted.
 *
 * @param refItem
 * @param parentUid
 */
const clearRefFrom = (refItem: CacheItem, parentUid) => {
  let refsArray = refItem.mapFrom.get(parentUid)
  if (!refsArray) {
    return
  }
  refItem.mapFrom = refItem.mapFrom.clone()
  refItem.mapFrom.delete(parentUid)
}

/**
  * Clears all
  *
  * @param parentItem
  * @param refUid
  */
const clearRefTo = (parentItem: CacheItem, refUid, instance: ICacheInstance) => {
  // first remove all instances of entity from the parent
  let parent = parentItem.entity
  if (Object.isFrozen(parent)) {
    parent = getEditItem(parent[config.uidName], instance)
    parentItem.entity = parent
  }
  let refPaths = parentItem.mapTo.get(refUid)
  refPaths.forEach(path => {
    opath.del(parent, path)
  })
  if (!Object.isFrozen(parent)) {
    Object.freeze(parent)
  }
  parentItem.entity = parent

  // then clear the metadata
  parentItem.mapTo = parentItem.mapTo.clone()
  parentItem.mapTo.delete(refUid)
  return true
}

/**
   * Removes this entity's references from all of its reference item's metadata.
   *
   * @param entityUid
   * @param flushMap
   * @param evictMap
   */
const clearTargetRefFroms = (entityUid: string, flushArgs: IFlushArgs) => {
  let item: CacheItem = getCachedItem(entityUid, flushArgs.instance)
  if (item) {
    item.mapTo.forEach((toUid, paths) => {
      let refItem: CacheItem = getItemFlushOrCached(toUid, flushArgs)
      if (refItem) {
        clearRefFrom(refItem, entityUid)
        if (refItem.mapFrom.size() === 0) {
          clearTargetRefFroms(toUid, flushArgs)
          flushArgs.evictMap.set(toUid, refItem)
        } else {
          flushArgs.flushMap.set(toUid, refItem)
        }
      }
    })
  }
}

/**
 * On evict remove all pointers and references to this entity.
 *
 * @param entityUid
 * @param flushMap
 */
const clearParentRefTos = (entityUid, uidArray, parentsChanged, flushArgs: IFlushArgs) => {
  let item: CacheItem = getItemFlushOrCached(entityUid, flushArgs)

  if (item) {
    item.mapFrom.forEach((parentUid, paths) => {
      let parentItem = getItemFlushOrCached(parentUid, flushArgs)
      if (parentItem) {
        let success = clearRefTo(parentItem, entityUid, flushArgs.instance)
        if (success === true) {
          flushArgs.flushMap.set(parentUid, parentItem)
          if (uidArray.indexOf(parentUid) < 0) {
            parentsChanged.push(parentItem)
          }
        }
      }
    })
  }
}
