import { cacheLength, isNumber } from './util'

import { ICacheInstance } from './CacheInstance'
import { ICacheNode } from './CacheNode'
import { ICacheStats } from './interfaces'
import { instances } from './cache'

/**
  * Gets the state of the cache.
  *
  * @param success The outcome of a cache operation
  * @param threadId optional thread id to request the
  *             cache history state for a specific thread
  * @returns {{}}
  */
export const getCallStats = (success: boolean, instance: ICacheInstance): ICacheStats => {
  let result: any = {}
  result.success = success
  result.nodeId = node(instance)
  result.length = length(instance)
  result.name = instance.name
  return result
}

/**
 * Gets or sets the current position of the cache by node id.
 * Using index() is not always reliable in case some nodes
 * are deleted to clear up memory. Node is more reliable
 * in terms of getting the id of a node that can be checked
 * for existence.
 *
 * @param nodeId the id of the node to navigate to if applicable
 * @returns {*} for node() - the id of the node if existing or -1 if cache is empty,
 *     for node(id) the current history state
 */
export const node = (instance: ICacheInstance, nodeId?): number | ICacheStats => {
  // guard for 0 values
  if (typeof nodeId === 'undefined') {
    let currentNode = getCurrentNode(instance)
    return currentNode ? currentNode.id : -1
  }

  if (!isNumber(nodeId)) {
    throw new TypeError('The node id must be a number.')
  }

  let cacheNode = getRepoNode(nodeId, instance)
  if (!cacheNode) {
    return getCallStats(false, instance)
  }
  instance.thread.current = binaryIndexOf(instance.thread.nodes, nodeId)
  return getCallStats(true, instance)
}

/**
  * The node currently being displayed by the cache.
  *
  * @param threadId
  * @returns {undefined} the cache node that the thread is currently left pointing at.
  */
export function getCurrentNode(instance: ICacheInstance) {
  let currentNodeId = instance.thread.nodes[instance.thread.current]
  // watch out currentNodeId evaluates to false when it's 0
  return currentNodeId >= 0 ? getRepoNode(currentNodeId, instance) : undefined
}

/**
 *
 *
 * @export
 * @param {any} cacheNodeId
 * @param {ICacheInstance} instance
 * @returns
 */
export function getRepoNode(cacheNodeId, instance: ICacheInstance) {
  return instance.repo.get(cacheNodeId)
}

/**
 * Number of current cache versions stored in the history nodes.
 * @returns {Number}
 */
const length = (instance: ICacheInstance) => instance.thread.nodes.length

/**
 * Performs a binary search on the array argument O(log(n)).
 * Use to search for item in the main stack which is sorted.
 *
 * @param {[]} array The sorted array to search on.
 * @param {*} searchElement The item to search for within the array.
 * @return {Number} The index of the element which defaults to -1 when not found.
 *
 * http://oli.me.uk/2013/06/08/searching-javascript-arrays-with-a-binary-search/
 */
function binaryIndexOf(array: Array<any>, searchElement) {
  var minIndex = 0
  var maxIndex = array.length - 1
  var currentIndex
  var currentElement

  while (minIndex <= maxIndex) {
    currentIndex = (minIndex + maxIndex) / 2 | 0
    currentElement = array[currentIndex]

    if (currentElement < searchElement) {
      minIndex = currentIndex + 1
    } else if (currentElement > searchElement) {
      maxIndex = currentIndex - 1
    } else {
      return currentIndex
    }
  }
}
