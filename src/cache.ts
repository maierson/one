import CacheInstance, { ICacheInstance } from './CacheInstance'
import { cacheLength, cacheSize } from './util'
import { configure, defaultConfig } from './config'
import { getEditItem, getItem } from './get'

import { ICacheStats } from './interfaces'
import { evictItem } from './evict'
import { getCachedItem } from './cacheUtil'
import { printCache } from './print'
import { putItem } from './put'

/**
 * All current instances of the cache.
 */
export const instances = {}
export let config
let cacheTest: boolean = false

export function setTesting(testing: boolean) {
  cacheTest = testing
}

export interface ICache {
  /* add item to the cache recursively and freeze deeply */
  put: Function,

  /* get frozen item from the cache */
  get: Function,

  /* get unfrozen(shallow) item copy from the cache
  inner uid references are still frozen and not copied */
  getEdit: Function,

  /* remove item from the cache, does not modify the current node
  but creates a new one without the evicted item in it */
  evict: Function,

  /* resets the cache and evicts all items*/
  reset: Function,

  /* number of items in the current node */
  size: Function,

  /* number of nodes in the cache */
  length: Function,

  /* put it on paper so I can look at it */
  print: Function,
}

/**
 * Creates and returns a single static instance of the cache
 * unique for the respective instance name.
 */
export function getCache(instanceName = 'one', configuration: {} = defaultConfig): ICache {
  if (!config) {
    config = configure(configuration)
  }

  if (!instances[instanceName]) {
    instances[instanceName] = createCache(instanceName)
  }
  if (typeof window !== 'undefined'
    && window !== null
    && window[instanceName] === undefined) {
    window[instanceName] = instances[instanceName]
  }
  return instances[instanceName]
}

export const put = (item: {} | Array<{}>) => {
  getCache().put(item)
}

export const get = (entity: string | number | {} | Array<any>, nodeId?: number) => (
  getCache().get(entity, nodeId)
)

export const getEdit = (uidOrEntityOrArray: string | number | {} | Array<any>, nodeId?: number) => (
  getCache().getEdit(uidOrEntityOrArray, nodeId)
)

export const evict = (uidOrEntityOrArray: string | number | {} | Array<any>): ICacheStats => (
  getCache().evict(uidOrEntityOrArray)
)

export const print = (): string => getCache().print()

export const reset = (): void => {
  getCache().reset()
}

/**
 * Utility function to create uuids.
 */
export const uuid = (): string => {
  // UUID
  var lut = []
  for (var i = 0; i < 256; i++) {
    lut[i] = (i < 16 ? '0' : '') + (i).toString(16)
  }

  // GUID generator http://jsperf.com/uuid-generator-opt/8
  var d0 = Math.random() * 0x100000000 | 0
  var d1 = Math.random() * 0x100000000 | 0
  var d2 = Math.random() * 0x100000000 | 0
  var d3 = Math.random() * 0x100000000 | 0
  return lut[d0 & 0xFF] + lut[d0 >> 8 & 0xFF] + lut[d0 >> 16 & 0xFF]
    + lut[d0 >> 24 & 0xFF] + '-' + lut[d1 & 0xFF]
    + lut[d1 >> 8 & 0xFF] + '-' + lut[d1 >> 16 & 0x0f | 0x40]
    + lut[d1 >> 24 & 0xFF] + '-' + lut[d2 & 0x3f | 0x80]
    + lut[d2 >> 8 & 0xFF] + '-' + lut[d2 >> 16 & 0xFF]
    + lut[d2 >> 24 & 0xFF] + lut[d3 & 0xFF] + lut[d3 >> 8 & 0xFF]
    + lut[d3 >> 16 & 0xFF] + lut[d3 >> 24 & 0xFF]
}

/**
 * Creates a singleton instance of the cache.
 *
 * @param {string} name optional name of the cache instance. Use it to retrive
 * cache instances by name.
 * @returns {ICache} a new cache instance.
 */
function createCache(name: string): ICache {

  const instance: ICacheInstance = new CacheInstance(name)

  /**
   * Empties the cache.
   */
  const reset = () => instance.reset()

  /**
   * Adds or updates an item in the cache and returns a set of
   * stats about the state of the cache after the operation is complete.
   *
   * @param {{} | Array<{}>} item the object or array of objects to be
   *          added / updated to the cache
   * @returns {ICacheStats} cache statistics.
   */
  const put = (item: {} | Array<{}>): ICacheStats => {
    return putItem(item, instance)
  }

  /**
   * @param {string | number | {} | Array<any>} entity entity or array of entities or entity uids
   *          to retrieve frozen from the cache
   * @param {number} nodeId optional id of a node to get the entities from
   *          in case of time travel.
   */
  const get = (entity: string | number | {} | Array<any>, nodeId?: number) => (
    getItem(entity, instance, nodeId)
  )

  /**
   * @param {string | number | {} | Array<any>} entity entity or array of entities or entity uids
   *          to retrieve cloned and editable from the cache
   * @param {number} nodeId optional id of a node to get the entities from
   *          in case of time travel.
   */
  const getEdit = (uidOrEntityOrArray: string | number | {} | Array<any>, nodeId?: number) => (
    getEditItem(uidOrEntityOrArray, instance, nodeId)
  )

  /**
   * Ejects an item or collection of items from the cache. Takes either
   * an object, a uid or a collection of each.
   *
   * @param {string | number | {} | Array<any>} uidOrEntityOrArray
   * @returns {ICacheStats} cache statistics.
   */
  const evict = (uidOrEntityOrArray: string | number | {} | Array<any>): ICacheStats => (
    evictItem(uidOrEntityOrArray, instance)
  )

  /**
   * @returns {number} the number of items cached on the current node.
   */
  const size = () => {
    return cacheSize(instance)
  }

  /**
   * @param instance the cache instance to evaluate.
   * @returns {number} the number of nodes in the current cache instance.
   */
  const length = () => cacheLength(instance)

  /**
   * @returns {string} a printable representation of the entire cache (all nodes).
   * Pass the result directly to console.log() for debugging.
   */
  const print = () => printCache(instance)

  let result = {
    put,
    get,
    getEdit,
    evict,
    reset,
    size,
    length,
    print,
  }

  // for testing only
  if (cacheTest === true) {
    (result as any).refTo = uid => {
      let item = getCachedItem(uid, instance)
      return item.mapTo
    }
    (result as any).refFrom = uid => {
      let item = getCachedItem(uid, instance)
      return item.mapFrom
    }
  }

  return result
}
