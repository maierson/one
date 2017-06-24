
/**
 * Hash map of a collection of paths.
 *
 * @export
 * @class CacheMap
 * @template T
 */
export default class CacheMap<T> {
  paths = {}
  length = 0

  set(key: string | number, value: T): boolean {
    if (typeof this.paths[key] === "undefined") {
      this.length++
      this.paths[key] = value
      return true
    }
    this.paths[key] = value
    return false
  }

  get = (key): T => {
    return this.paths[key]
  }

  delete = (key): boolean => {
    if (typeof this.paths[key] !== 'undefined' && this.length > 0) {
      let val = this.paths[key]
      delete this.paths[key]
      this.length--
      return val
    }
  }

  has = (key): boolean => typeof this.paths[key] !== 'undefined'

  forEach = (callback: Function) => {
    for (var key in this.paths) {
      if (this.paths.hasOwnProperty(key)) {
        callback(key, this.paths[key])
      }
    }
  }

  clone = (): CacheMap<T> => {
    let clone: CacheMap<T> = new CacheMap<T>()
    clone.paths = { ...this.paths, }
    clone.length = this.length
    return clone
  }

  size(): number {
    return this.length
  }
}
