import CacheMap from './CacheMap'

/**
 * Stores a reference to a single entity inside a ICacheNode. It also
 * holds refTo and refFrom metadata for all outgoing or incoming
 * references to the entity. These are used to efficiently update
 * all instances of the entity in the cache when the entity changes.
 */
export default class CacheItem {
  entity
  mapTo: CacheMap<Array<string>>
  mapFrom: CacheMap<Array<string>>

  constructor(entity, liveItem?: CacheItem) {
    this.entity = entity
    // if existing copy the data from the live item else just initialize it
    if (liveItem) {
      // each path is an array of strings so they get duplicated automatically
      this.mapFrom = liveItem.mapFrom.clone()
      this.mapTo = liveItem.mapTo.clone()
    } else {
      this.mapFrom = new CacheMap<Array<string>>()
      this.mapTo = new CacheMap<Array<string>>()
    }
  }

  clone = () => new CacheItem(this.entity, this)
}
