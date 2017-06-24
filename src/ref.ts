import * as opath from './path'

import { ensureItem, getCachedItem, getItemFlushOrCached } from './cacheUtil'

import CacheItem from './CacheItem'
import { IFlushArgs } from './interfaces'
import { config } from './cache'
import { deepClone } from './util'

/**
  * Adds mapTo metadata to a parent item that contains a referenced uid entity.
  *
  * @param {{}} parentItem the item of the parent entity
  * @param {string} refUid the uid of the referenced entity
  * @param {string} path the path inside the parent entity where the referenced entity is located
  * @returns {{}} the parentItem just in case it was cloned for purity
  */
const addRefTo = (parentItem, refUid, path) => {
  if (parentItem.mapTo.has(refUid) === false) {
    parentItem.mapTo.set(refUid, [])
  }
  let refArray = parentItem.mapTo.get(refUid)
  if (refArray.indexOf(path) < 0) {
    refArray.push(path)
  }
  return parentItem
}

/**
 * Adds mapFrom metadata to a referenced item that is contained in the parent entity.
 *
 * @param {{}} refItem the item of the referenced entity
 * @param {string} parentUid the uid of the parent entity
 * @param {string} path the path inside the parent entity where the referenced entity is located
 */
const addRefFrom = (refItem, parentUid, path) => {
  if (refItem.mapFrom.has(parentUid) === false) {
    refItem.mapFrom.set(parentUid, [])
  }
  let fromArray = refItem.mapFrom.get(parentUid)
  if (fromArray.indexOf(path) < 0) {
    fromArray.push(path)
  }
  return refItem
}

/**
 * Records the dependencies of a uid entity (in refItem) to its containing uid entity (in parentItem).
 * @param parentItem cache item of the entity containing the reference
 * @param refItem cache item of the reference entity
 * @param path array containing all the path segments where the itme is located
 */
const assignRefs = (parentItem: CacheItem, refItem: CacheItem, path: Array<string>) => {
  let parentUid = parentItem.entity[config.uidName]
  let refUid = refItem.entity[config.uidName]
  const refPath = path.join('.')
  // add parent reference to child
  addRefTo(parentItem, refUid, refPath)
  addRefFrom(refItem, parentUid, refPath)
}

export const assignRefToParent = (refItem, parentUid, path: Array<string>, flushArgs: IFlushArgs) => {
  if (parentUid) {
    let parentItem = getItemFlushOrCached(parentUid, flushArgs)
    if (parentItem && path.length > 0) {
      assignRefs(parentItem, refItem, path)
    }
  }
}

export const updateRefFroms = (item: CacheItem, flushArgs: IFlushArgs) => {
  if (item.mapFrom.length > 0) {
    item.mapFrom.forEach((parentUid, paths) => {
      let parentItem = flushArgs.flushMap.get(parentUid)

      if (!parentItem) {
        parentItem = getCachedItem(parentUid, flushArgs.instance)
      }

      /* only update if dirty - no need to iterate all paths - just check the first one
      - if dirty then the parent entity needs to be cloned and updated anyways so pass in
      the ref entity when cloning - it will be updated wherever it is encountered during cloning */
      if (parentItem && paths.length > 0) {
        let firstPath = paths[0]
        let targetRef = opath.get(parentItem.entity, firstPath)

        // dirty ?
        if (targetRef && targetRef !== item.entity) {
          let args: IFlushArgs = {
            flushMap: flushArgs.flushMap,
            instance: flushArgs.instance,
          }
          parentItem = ensureItem(parentItem.entity, args)

          // TODO figure out a way to not clone the entity every time particularly if it is
          // already present on the flush map

          // the entity is still frozen here - clone it to update and freeze it deeply
          parentItem.entity = deepClone(parentItem.entity, item.entity, true)
        }
      }
    })
  }
}

const removeRefFrom = (item, parentUid, path) => {
  let refsArray = item.mapFrom.get(parentUid)

  let index = refsArray.indexOf(path)

  // make an editable copy
  refsArray = refsArray.slice()
  refsArray.splice(index, 1)
  item.mapFrom.set(parentUid, refsArray)
  if (refsArray.length == 0) {
    item.mapFrom.delete(parentUid)
  }
}

/**
  * Removes a path value from an item's mapFrom metadata. It places it either on the flush map if it was updated or
  * the evict map if there are no references left over.
  *
  * @param parentUid uid of the entity holding the reference that might have been changed
  * @param refUid uid of the entity being referenced
  * @param path path in the parent entity where the referenced entity is located
  * @param flushMap map of updated items to be persisted into the cache
  * @param evictMap map of updated items to be removed from the cache
  */
const removeRefFromValue = (parentUid, refUid, flushArgs: IFlushArgs, path: string) => {
  // get the item of the referenced entity
  let refItem: CacheItem = getItemFlushOrCached(refUid, flushArgs)
  if (refItem) {
    // make a new instance (pure function)
    refItem = refItem.clone()// objectAssign({}, refItem)

    // remove the path from the refFrom
    if (refItem.mapFrom.has(parentUid)) {
      // get the array of refs
      removeRefFrom(refItem, parentUid, path)
      if (refItem.mapFrom.size() === 0) {
        flushArgs.evictMap.set(refUid, refItem)
        // just in case
        flushArgs.flushMap.delete(refUid)
      } else {
        flushArgs.flushMap.set(refUid, refItem)
        // just in case
        flushArgs.evictMap.delete(refUid)
      }
    }
  }
}

const updateItemRefTos = (item: CacheItem, flushArgs: IFlushArgs) => {
  if (!item || !item.mapTo) {
    return
  }

  // check the references for each referenced item. References are keyed by
  // refToUid in the refTo object. Each refToUid value is an array containing
  // a list of paths where the reference is located inside this entity
  item.mapTo.forEach((toUid, paths) => {

    // get the list of paths + update the paths array
    // to contain only the remaining references
    let updatedPaths = paths.filter(path => {
      let reference = opath.get(item.entity, path)
      const hasRef = reference && String(reference[config.uidName]) === String(toUid)
      if (!hasRef) {
        removeRefFromValue(item.entity[config.uidName], toUid, flushArgs, path)
      }
      return hasRef
    })

    // update or remove the paths
    if (updatedPaths.length > 0) {
      item.mapTo.set(toUid, updatedPaths)
    } else {
      item.mapTo.delete(toUid)
    }
  })
}

/**
 *
 * @param flushMap
 */
export const updatePointers = (flushArgs: IFlushArgs) => {
  // at this point all items are added into the flush map - update their pointers if applicable
  flushArgs.flushMap.forEach((key, item: CacheItem) => {
    // do not modify flush map on its own iteration but ok to pass along for reference
    updateItemRefTos(item, flushArgs)
    updateRefFroms(item, flushArgs)
  })
}

/**
  * Checks the refTo metadata to ensure that all referenced items are still in this entity.
  *
  * @param entityUid the entity to be checked for refTo integrity
  * @param flushMap
  * @param evictMap map of potentially deletable items in case all references have been removed
  */
export const updateRefTos = (entityUid, flushArgs: IFlushArgs) => {
  let item = getItemFlushOrCached(entityUid, flushArgs)
  updateItemRefTos(item, flushArgs)
}
