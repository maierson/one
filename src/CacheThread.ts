
/**
 * Linear collection of nodes. Contains all the information
 * required to sequentially keep track of cache nodes. Use the
 * node id to locate the actual node in the repo.
 *
 * @export
 * @interface ICacheThread
 */
export interface ICacheThread {
  /** index of node currently showing (selected)
   unless there is time travel involved this is the
   index of the last node added */
  current: number,

  /* array of all node indices available for time travel */
  nodes: Array<number>,

  addNode: (nodeId: number) => void,
}

/**
 * Contains all the information required to sequentially keep track of cache nodes.
 */
export default class CacheThread implements ICacheThread {
  current: number = -1
  nodes: Array<number> = []

  addNode = (nodeId: number) => {
    this.nodes.push(nodeId)
    this.current++
  }
}
