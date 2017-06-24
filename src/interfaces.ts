import CacheItem from './CacheItem';
import CacheMap from './CacheMap';
import { ICacheInstance } from './CacheInstance';

/**
 * Config object used for flushing changes to a specific cache instance.
 * Holds all variables that are constant throughout the flushing cycle.
 */
export interface IFlushArgs {

  /** atomic operation map for flushing all changes at once */
  flushMap: CacheMap<CacheItem>,

  /** map of potential evicts in case of de-referencing */
  evictMap?: CacheMap<CacheItem>,

  /** instance of the cache currently being modified */
  instance: ICacheInstance
}

/**
 * Cache statistics.
 *
 * @export
 * @interface ICacheStats
 */
export interface ICacheStats {
  /**
   * Whether the operation was successful or failed
   */
  success: boolean,

  /**
   * Id of the node that the current operation created (when successful)
   */
  nodeId: number,

  /**
   * Total number of nodes on the cache
   */
  length: number,

  /**
   * Name of the cache instance - defaults to 'one'. Multiple
   * cache concurrent instances can be created but each is a
   * singleton retrievable by name.
   */
  name: string,
}
