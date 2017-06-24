import { assignRefToParent, updateRefTos } from './ref'
import { ensureItem, ensureOnFlushMap, isOnCache, isOnFlushMap } from './cacheUtil'
import { hasUid, isArray, isObject } from './util'

import { IFlushArgs } from './interfaces'
import { config } from './cache'

/**
 * Entry point for the main parsing function.
 *
 * Analyzes an object tree and puts all the uid items onto
 * the flush map for atomic (single op) flushing to the cache.
 */
export const parse = (entity, flushArgs: IFlushArgs) => {
  if (hasUid(entity)) {
    // if it's the same entity on the cache then abort
    if (isOnCache(entity, flushArgs.instance)) return

    // not the same - cache entity
    _addToFlushMap(entity, flushArgs)
  } else {
    if (isArray(entity)) {
      parseArray(entity, null, [], flushArgs)
    } else if (isObject(entity)) {
      parseObject(entity, null, [], flushArgs)
    }
  }
}

/**
 * Adds a single uid entity to the flush map.
 */
const _addToFlushMap = (entity, flushArgs: IFlushArgs) => {

  ensureOnFlushMap(entity, flushArgs)

  // reset the parent uid to this entity
  // every uid entity is the beginning of a new path and parentUid
  parseEntity(entity, entity[config.uidName], [], flushArgs)

  // done with building this entity
  // check its reference paths to make sure nothing is stale
  updateRefTos(
    String(entity[config.uidName]),
    flushArgs
  )
}

/**
 *
 */
const cacheUidObj = (entity, parentUid, path: Array<string>, flushArgs: IFlushArgs) => {
  // ensure the entity is on an item with the proper path referenced
  let item = ensureItem(entity, flushArgs)

  // assign all item refs to the parent
  if (parentUid) {
    assignRefToParent(item, parentUid, path, flushArgs)
  }

  // check if entity is already cached
  if (isOnCache(entity, flushArgs.instance)
    || isOnFlushMap(entity, flushArgs.flushMap)) return

  // if not cached add it to the flush map
  parse(entity, flushArgs)
}

/**
 * Parses an object with or without uid.
 */
const parseObject = (obj, parentUid, path, flushArgs) => {
  if (hasUid(obj)) {
    cacheUidObj(obj, parentUid, path, flushArgs)
  } else {
    parseEntity(obj, parentUid, path, flushArgs)
  }
}

/**
 * Parses an array. Can call itself recursively.
 */
const parseArray = (arr, parentUid, path: Array<string> = [], flushArgs) => {
  arr.forEach((item, index) => {
    if (isArray(item)) {
      parseArray(item, parentUid, [...path, index], flushArgs)
    } else if (isObject(item)) {
      parseObject(item, parentUid, [...path, index], flushArgs)
    }
  })
}

/**
 * Parse an entity recursively whether it has a uid or not.
 */
const parseEntity = (entity, parentUid, path: Array<string> = [], flushArgs: IFlushArgs) => {
  for (let key in entity) {
    if (entity.hasOwnProperty(key)) {
      let ref = entity[key]

      if (isArray(ref)) {
        parseArray(ref, parentUid, [...path, key], flushArgs)
      } else if (isObject(ref)) {
        parseObject(ref, parentUid, [...path, key], flushArgs)
      }
      Object.freeze(ref)
    }
  }
}
