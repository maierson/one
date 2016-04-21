/**
 * Created by maierdesign on 1/19/16.
 */
/**
 * Prefix every reference to a uid with this prefix in order for the parser to recognize it as a uid reference instead
 * of a simple string or number.
 * @type {string}
 */
//export const UID_PREFIX = "__UID__";

/**
 * Keyes in the entity on an item stored in the cache.
 * @type {string}
 */
// when printing the nodes these get replaced with their respective values. use distinct names - ie prefix with cuid_
export const ENTITY = "entity";

/**
 * Keyes in the pointers on an item stored in the cache
 * @type {string}
 */
export const REF_FROM = "ref_from";

/**
 * Keyes in the references inside an item stored in the cache. In order to avoid deeply iterating an object for its uid
 * reference every time instead store the uids at put time. This way it's easy to know whether an item was removed from
 * the entity on the next put.
 * @type {string}
 */
export const REF_TO = "ref_to";

/**
 * Whether a temp map was updated as a result of a cache operation.
 * @type {string}
 */
export const UPDATED_KEY = "mapUpdatedKey";
