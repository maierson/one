import CacheMap from './CacheMap'
import { ICacheNode } from './CacheNode'

/**
 * Holds all of a cache instance's nodes keyed in by nodeId
 * for fast direct access.
 *
 * @export
 * @interface ICacheRepo
 */
export interface ICacheRepo {
  length: number,
  get: (nodeId: number) => ICacheNode,
  add: (node: ICacheNode) => boolean,
  delete: (nodeId: number) => void
}

export default class CacheRepo implements ICacheRepo {
  items: CacheMap<ICacheNode> = new CacheMap<ICacheNode>()
  length: number = 0

  get = (nodeId): ICacheNode => (this.items.get(nodeId))

  add = (node: ICacheNode) => {
    if (!this.items.has(node.id)) {
      this.items.set(node.id, node)
      this.length++
      return true
    }
    return false
  }

  delete = (nodeId: number) => {
    if (this.items.has(nodeId)) {
      this.items.delete(nodeId)
      this.length--
    }
  }
}
