import CacheRepo, { ICacheRepo } from './CacheRepo'
import CacheThread, { ICacheThread } from './CacheThread'

import { ICacheNode } from './CacheNode'

/**
 * Defines each instance of the cache.
 */
export interface ICacheInstance {

  /**
   * Name of the instance in order to locate it in the instance pool.
   */
  name: string,

  /**
   * Store all nodes in a centralized repository to access them by key.
   * The key needs to be unique only amongst nodes.
   * It's a simple incrementor starting at 0
   */
  repo: ICacheRepo,

  thread: ICacheThread,

  /** Increment this key every time a new node is assigned. */
  nextNodeKey: number,

  reset: () => void,

  addNode: (node: ICacheNode) => boolean,

  /* number of entities in the instance's repo */
  size: () => number,

  /* number of nodes in the instance */
  length: () => number
}

export default class CacheInstance implements ICacheInstance {
  name: string
  repo: ICacheRepo = new CacheRepo()
  thread: ICacheThread = new CacheThread()
  nextNodeKey: number = 0

  constructor(name: string) {
    this.name = name
  }

  reset = () => {
    this.repo = new CacheRepo()
    this.thread = new CacheThread()
    this.nextNodeKey = 0
  }

  addNode = (node: ICacheNode): boolean => {
    if (this.repo.add(node)) {
      this.thread.addNode(node.id)
      this.nextNodeKey++
      return true
    }
    return false
  }

  length = (): number => this.thread.nodes.length

  size = (): number => this.repo.length
}
