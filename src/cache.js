"use strict";

import {isObject, isArray, hasUid, cloneSet, deepClone, isString, isNumber} from './utils/clone';
import deepFreeze from './utils/deepFreeze';
import * as config from './utils/config';
import * as opath from './utils/path';

import {ENTITY, REF_FROM, REF_TO, UPDATED_KEY} from './utils/constants';

// One's intent is to always return the same entity regardless of how many different references are to it from
// various objects claiming it. All data is immutable and entities are frozen when added to the cache. This means that
// once you insert an entity into the cache it will be frozen and not editable even if you keep hold of your own
// previous entity reference (it is in fact the same one in memory). In order to further edit an entity after it has
// been added to the cache you must call getEdit() in order to get an unfrozen clone from the cache.

// The cache stores each frozen entity plus some metadata about it. The metadata contains pointers to all other
// referencing entities and the property names where the reference is found such as that when an entity is updated all
// other entities in the cache referencing it are also updated with the newly changed version. This can obviously
// introduce some serious lags - O(n^2) processing - so some compromises must be made to mitigate this, particularly
// when putting into the cache a list of multiple entities.

// Assumptions:
// 1. putting a single entity and updating all of its references after it has been changed is manageable.
// 2. putting a list of entities does not update existing corresponding entities (same uid) in the cache. The
// assumption is that if the entity exists in the cache already it will either be updated singlehandedly by calling
// getEdit() OR it is newer than the entity currently being put from the list in which case it should not be
// replaced. Replacing an entity in the cache causes it to be updated within all the referencing entities which is
// potentially a very expensive operation.

// Getting an entity from the cache returns a frozen entity that can be used for display purposes. For editing use
// getEdit() method which returns an unfrozen deep clone of the cached entity. This entity can be edited and put
// back into the cache once the editing operation is complete. This causes the cache to store the edited copy of the
// existing entity such as frozenEntity !== editedEntity. The application can use this fast check to see whether its
// version of an entity isDirty() and update itself accordingly as needed (React's shouldComponentUpdate() works in
// this fashion).

// PERFORMANCE CONSIDERATIONS:
// There are 3 possible bottlenecks depending on the update strategy used (read optimized or write optimized).

// 1. PUT the entity first. This cost is incurred regardless of read or write optimization. In order to keep a
// map of all uid entities on the cache each entity added to the cache must be scanned for contained uid references.
// This is potentially expensive particularly when there is need for a fast UI update immediately after a cache write.
// OPTIMIZATION: use a 2 tiered write operation, queue - adds all entities from a list to a temporary map without
// a deep scanning of each entity. This permits a fast update of the UI but requires a subsequent manual commit()
// call in order to perform the deep put scan after the UI updates have been processed. You should manage the commit
// operations to execute at a time when you know there is no UI processing visible to the user such as to keep a smooth
// flow appearance.

// 2. WRITE OPTIMIZATION. Every time that a uid entity is updated all of its references must be updated. In order to
// optimize the write operation the methodology would be to only optimize the direct map reference at the uid key of
// the entity - single operation O(1). However each read would then have to scan each entity for its updated reference
// and replace it into the entity at the correct location. Fast writes, slow reads O(n). Since there are a lot more
// reads than writes in any application this is not the way it's implemented.

// 3. READ OPTIMIZATION. Have each entity updated on write and ready on every read. Still O(n) but each entity is
// retrieved by key from its location on the map and with proper pagination this if very manageable. However this
// requires that all referencing parents are updated on write for each entity write. This is potentially slow but by
// updating a single entity at a time the cost is much lower than Write optimization. This is how One works.
// Further OPTIMIZATION - when putting a list DO NOT update uid entities already existing in the cache. Instead replace
// the entity in the list with the existing cache entity thus avoiding a potentially expensive update pointers
// operation for the existing entity. The caveat is that each entity that is changed and updated must be done so one at
// a time.

// Structure:
// Node Stack: The cache is made up of a stack of immutable cache nodes. Each cache modifying operation creates a new
// node containing all the entities present in the cache at that point in time. You may think of this as a snapshot in
// time of the application store. All nodes are stored in a repo map to be easily accessed by nodeId. They are
// referenced by id in various threads.

// Threads: threads permit the cache to be separated into node subsets in order to control the granularity of the time
// travel mechanism. Each thread has an id and its own stack of nodeIds assigned to the thread. There is a default
// "main" thread always present. It references all the nodes in the main stack. All other threads are user created and
// removed. You may have an unlimited number of threads although it is good practice to keep the number low.

/**
 *
 * @param {boolean} debug set to true in order to return an object that contains debugging methods (count etc)
 * @param {string} libName optional library name
 * @returns {*}
 */
export default function createCache(debug = true, libName = "One") {
    if (window) {
        if (window[libName] === undefined) {
            window[libName] = getCache(debug);
        }
        return window[libName];
    }
    /* istanbul ignore next */
    return getCache(debug);
}

/**
 *
 * @param debugParam
 * @returns {{put: put, get: get, getEdit: getEdit, evict: evict, reset: reset, queue: queue, unQueue: unqueue,
 *     queueEvict: queueEvict, getQueued: getQueued, commit: commit, undo: undo, redo: redo, index: index, node: node,
 *     getHistoryState: getHistoryState, isDirty: isDirty, uuid: createUUid, contains: contains, config: setConfig,
 *     subscribe: subscribe}}
 */
function getCache(debugParam = false) {
    "use strict";

    /**
     * Contains all the information required to sequentially keep track of cache nodes.
     */
    let mainThread;

    /**
     * Increment this key every time a new node is assigned.
     * @type {number}
     */
    let nextNodeKey = 0;

    /**
     * Store all nodes in a centralized repository to access them by key. The key needs to be unique only amongst
     * nodes so it's a simple incrementor starting at 0
     * @type {Map}
     */
    const repo = new Map();

    /**
     * Queue of entities that are awaiting to be put on the cache. Use for fast access when speed of updating UI is
     * critical. Call commit to put into the cache.
     */
    let putQueue   = getNewLengthObj();
    let evictQueue = getNewLengthObj();

    /**
     * List of listeners to be notified of cache changes.
     * @type {Array}
     */
    let listeners = [];

    // PUBLIC
    /**
     * Resets the cache to empty.
     */
    const reset = () => {
        // TODO - should commit or warn before clearing the putQueue ?
        putQueue = getNewLengthObj();
        repo.clear();
        mainThread  = undefined;
        mainThread  = createThread();
        nextNodeKey = 0;
    };

    reset();

    /**
     * Creates a new thread. Idempotent: if thread exists returns existing thread.
     *
     * @returns {*} the newly created thread
     */
    /* hoisted for reset - keep as function def*/
    function createThread() {
        if (!mainThread) {
            mainThread = getNewLengthObj();

            // the thread's current position
            mainThread.current = -1;

            // collection of nodeIds referenced by the thread
            mainThread.nodes = [];
        }
        return mainThread;
    }

    /**
     * Creates a new cache node and adds it to the repo.
     *
     * @returns {*} a newly created cache node after adding it to the repo.
     */
    function getNewCacheNode() {
        let node = getNewLengthObj();
        node.id  = nextNodeKey;
        nextNodeKey += 1;
        repo.set(node.id, node);
        return node;
    }

    // use ES5 function definition here (not fat arrow) to allow it to be hoisted for putQueue initialization
    function getNewLengthObj() {
        let obj = {};

        Object.defineProperty(obj, "length", {
            value     : 0,
            enumerable: false,
            writable  : true
        });

        return obj;
    }

    /**
     * Configures the property names used to track item merging prevalence.
     * @param conf
     */
    const setConfig = conf => {
        if (size() > 0) {
            throw new Error("You may only configure an empty cache. Please clear the cache first and then configure.");
        }
        config.config(conf);
    };

    // PUT

    /**
     * Puts an item on the cache and updates all its references to match any present in the item's entity tree
     * @param {Object|Object[]} entityOrArray object to be put into the context
     * @param {string|string[]} threadIds id or array of ids for all the threads this items should be added to
     * @param {boolean} strong force replace items on the cache even if they exist
     * @returns {*} true if the cache has been modified, false otherwise or the object itself if the item has no uid
     */
    const put = (entityOrArray, strong = true) => {
        // TODO ****** freeze arrays on put
        // only mergeThread entities with uid
        if ((isArray(entityOrArray) || isObject(entityOrArray))) {
            const flushMap = new Map();
            // map of potential evicts in case of de-referencing
            const evictMap = new Map();
            flushMap.set(UPDATED_KEY, false); // track whether the map has changed updated
            buildFlushMap(entityOrArray, flushMap, null, evictMap, strong);
            updatePointers(flushMap);

            // track if data actually changed
            let changed = flushMap.get(UPDATED_KEY);
            flushMap.delete(UPDATED_KEY);

            let success = false;
            if (flushMap.size > 0 && changed) {
                // remove from the nodes all states coming after the current state (clears history after now)
                clearNext();
                addItems([...flushMap.values()], evictMap);
                notify();
                success = true;
            }
            return getHistoryState(success);
        } else {
            return getHistoryState(false);
        }
    };

    /**
     * **** QUEUING DOES NOT UPDATE THE CACHE on commit IF THE ENTITY ALREADY EXISTS - instead it uses the entity
     * version present in the cache ****
     *
     * Simply puts an item on the putQueue map in order to track for later commits.
     * @param entityOrArray
     * @param {boolean} strong there are two types of queueing ops. Weak - only puts in the queue if it doesn't already
     *     exist in the cache. Strong - adds to the queue even if item exists in the cache. If so entity (and all its
     *     descendants) will be overwritten in the cache at the next commit.
     * @returns {boolean}
     */
    const queue = (entityOrArray, strong = false) => {
        let modified = [];
        if (isArray(entityOrArray)) {
            entityOrArray.forEach(entity => {
                addToQueue(entity, modified);
            });
        } else if (isObject(entityOrArray)) {
            addToQueue(entityOrArray, modified);
        }

        function addToQueue(entity, modified) {
            if (hasUid(entity)) {
                let uid      = entity[config.prop.uidName];
                let existing = putQueue[uid];
                if (strong || !existing) {
                    // only replace on strong or if it doesn't exist on cache
                    if (strong || !get(uid)) {
                        if (!getQueued(uid)) {
                            putQueue.length += 1;
                        }
                        putQueue[uid] = entity;
                        modified.push(uid);
                    }
                }
            }
        }

        let added = modified.length > 0;
        if (added) {
            notify(modified);
        }
        return modified.length;
    };

    /**
     * Removes a uid entity from the queue.
     * @param {String|Object} uidOrEntity uid or entity to be removed from the queue.
     */
    const unqueue = uidOrEntity => {
        // TODO make this for list of entities or uids
        let realUid = getActualUid(uidOrEntity);
        if (!realUid) {
            return;
        }
        if (putQueue[realUid]) {
            putQueue[realUid] = undefined;

            //delete putQueue[realUid];
            if (putQueue.length > 0) {
                putQueue.length -= 1;
            }
            return true;
        }
        return false;
    };

    /**
     * Commits any pending items that might be pending (ie putQueue)
     *
     * @param {string|number|Array<string>} threadIds optional stream ids to commit to
     * @param {boolean} strong set to true to replace existing items in the cache, false to maintain existing items
     */
    const commit = (threadIds, strong = false) => {
        if (putQueue.length > 0) {
            let arr = [];
            for (let prop in putQueue) {
                if (putQueue.hasOwnProperty(prop)) {
                    arr.push(putQueue[prop]);
                }
            }
            let state = put(arr, threadIds, strong);
            if (state.success === true) {
                putQueue = getNewLengthObj();
            }
            return state;
        }
        return getHistoryState(false);
    };

    /**
     *
     * Same as queue() for evict.
     * @param uidEntity
     */
    const queueEvict = uidEntity => {
        if (!uidEntity || !hasUid(uidEntity)) {
            return false;
        }
        evictQueue[uidEntity[config.prop.uidName]] = uidEntity;
        return true;
    };

    /**
     * Gets an item from the queue if existing.
     *
     * @param uidOrEntity
     * @returns {*}
     */
    const getQueued = uidOrEntity => {
        let realUid = getActualUid(uidOrEntity);
        if (!realUid) {
            return;
        }
        return putQueue[realUid];
    };

    /**
     * Gets a frozen item out of the cache if existing. This item is for display purposes only (not editable) and is
     * the actual object stored in the cache (not a clone). This is so that we can perform an actual fast identity op
     * when checking for isDirty()
     *
     * @param uidOrEntityOrArray
     */
    const get = uidOrEntityOrArray => {
        if (!uidOrEntityOrArray) {
            throw new TypeError("One get(): requires a uid to retrieve an item from the cache.");
        }
        if (isArray(uidOrEntityOrArray)) {
            return uidOrEntityOrArray.map(item => {
                return getObject(item);
            }).filter(item => {
                return item !== null && item !== undefined;
            })
        }
        return getObject(uidOrEntityOrArray);
    };

    /**
     *
     * @param {Object|string|Object[]|string[]}obj Either a single entity or its uid or an array of
     *     entities or an array of uids (cannot mix entities with uids)
     * @return boolean true if the state was modified, false otherwise
     */
    const evict = obj => {
        let uidArray = buildEvictUidArray(obj);
        if (uidArray.length == 0) {
            return false;
        }
        let currentState = getCurrentMainStack();
        let found        = uidArray.some(item => {
            return currentState && currentState.has(String(item));
        });

        if (!found) {
            return false;
        }

        let tempState = new Map();
        currentState.forEach((value, key) => {
            tempState.set(key, value);
        });

        // remove subsequent states - altering the nodes
        clearNext();

        let flushMap = new Map();
        let evictMap = new Map();

        uidArray.forEach(uid => {
            // remove REF_FROM in item references metadata
            clearTargetRefFroms(uid, flushMap, evictMap);
            // value doesn't matter here - will be evicted
            evictMap.set(uid, null);
            // remove REF_TO in parent metadata
            clearParentRefTos(uid, flushMap);
        });

        // updates
        flushMap.forEach((item, key) => {
            tempState.set(key, item);
        });

        // evicts
        evictMap.forEach((item, key) => {
            tempState.delete(key);
        });

        flush(tempState);
        notify();
        return true;
    };

    /**
     *
     * @param obj
     * @returns {*}
     */
    const buildEvictUidArray = obj => {
        let uidArray = [];
        if (isArray(obj)) {
            // array - check if we have uids or strings
            obj.forEach(item => {
                if (hasUid(item)) {
                    uidArray.push(String(item[config.prop.uidName]));
                } else {
                    if (typeof item === "string" || typeof item === "number") {
                        uidArray.push(String(item))
                    }
                    // else nothing - skip it
                }
            });
        } else {
            let uid = obj;
            if (isObject(obj)) {
                uid = obj[config.prop.uidName];
            }
            if (uid === undefined) {
                return uidArray;
            }
            uidArray.push(String(uid));
        }
        return uidArray;
    };
    // PUT UTILS

    /**
     *
     * @param flushMap
     */
    const updatePointers = (flushMap) => {
        // at this point all items are added into the flush map - update their pointers if applicable
        flushMap.forEach((item, key) => {
            if (key !== UPDATED_KEY) {

                // do not modify flush map on its own iteration but ok to pass along for reference
                let refsFrom = item[REF_FROM];

                // parentUid = uid of the item being targeted for ref update (ie the ref's parent)
                for (let parentUid in refsFrom) {
                    if (refsFrom.hasOwnProperty(parentUid)) {

                        let paths      = refsFrom[parentUid];
                        let parentItem = flushMap.get(parentUid);
                        if (!parentItem) {
                            parentItem = getLiveItem(parentUid);
                        }

                        /* only update if dirty - no need to iterate all paths - just check the first one
                         - if dirty then the parent entity needs to be cloned and updated anyways so pass in
                         the ref entity when cloning - it will be updated wherever it is encountered during cloning */
                        if (parentItem && paths.length > 0) {
                            let firstPath = paths[0];
                            let targetRef = opath.get(parentItem[ENTITY], firstPath);
                            // check for dirty
                            let dirty = (targetRef && targetRef !== item[ENTITY]);

                            if (dirty === true) {
                                parentItem = ensureItem(parentItem[ENTITY], flushMap);

                                // TODO figure out a way to not clone the entity every time particularly if it is
                                // already present on the flush map

                                // the entity is still frozen here - clone it to update and freeze it deeply
                                parentItem[ENTITY] = deepClone(parentItem[ENTITY], item[ENTITY], true);
                            }
                        }
                    }
                }
            }
        });
    };

    /**
     * Analyzes an entity deeply and adds all its cacheable references to the flushMap so that they can be all flushed
     * together in a single operation. This results in a single cache node being added for all the cached entities.
     *
     * @param entity
     * @param flushMap
     * @param parentUid
     * @param evictMap
     * @param strong
     */
    const buildFlushMap = (entity, flushMap, parentUid, evictMap, strong) => {
        if (hasUid(entity)) {
            buildFlushMap_uid(entity, flushMap, parentUid, evictMap, strong);
        } else {
            if (isArray(entity)) {
                cacheArrRefs(entity, flushMap, parentUid, evictMap,"", strong);
            } else {
                cacheEntityRefs(entity, flushMap, parentUid, evictMap,"", strong);
            }
            Object.freeze(entity);
        }
    };

    /**
     * Builds the flush map for an entity that has a unique id property.
     *
     * @param entity the entity the flush map is built for
     * @param flushMap
     * @param parentUid uid of the entity's parent (the entity containing a reference to this entity)
     * @param evictMap
     */
    const buildFlushMap_uid = (entity, flushMap, parentUid, evictMap, strong) => {
        let entityUid = String(entity[config.prop.uidName]);

        if (isOnCache(entity) === true) {
            // this exists and wasn't changed - this is also ok when a deeply nested entity has been changed as
            // entities are deeply frozen - so in order to edit the deeply nested entity the top one must be
            // retrieved as editable
            return;
        }

        if(strong === false && getLiveItem(entity[config.prop.uidName])){
            // is on cache regardless of whether it's strong or not
            return;
        }

        if (!flushMap.has(entityUid)) {
            ensureItem(entity, flushMap);
            // reset the parent uid to the object being iterated down
            parentUid = String(entityUid);

            // iterate all item's properties
            cacheEntityRefs(entity, flushMap, parentUid, evictMap, "", strong);

            // freeze after props as might need to modify the entity if cached uid prop exists
            if (!Object.isFrozen(entity)) {
                Object.freeze(entity);
            }
        }
        else {
            cacheEntityRefs(entity, flushMap, parentUid, evictMap, "", strong);
        }

        // done with building this entity - check its reference paths to make sure nothing is stale
        updateRefTos(entityUid, flushMap, evictMap);
    };

    /**
     * Removes this entity's references from all of its reference item's metadata.
     *
     * @param entityUid
     * @param flushMap
     * @param evictMap
     */
    const clearTargetRefFroms = (entityUid, flushMap, evictMap) => {
        let item = getLiveItem(entityUid);
        if (item) {
            let refTo = item[REF_TO];
            for (let refToUid in refTo) {
                if (refTo.hasOwnProperty(refToUid)) {
                    let refItem = getItemFlushOrAlive(refToUid, flushMap);
                    if (refItem) {
                        clearRefFrom(refItem, entityUid);
                        if (refItem[REF_FROM].length === 0) {
                            clearTargetRefFroms(refToUid, flushMap, evictMap);
                            evictMap.set(refToUid, refItem);
                        } else {
                            flushMap.set(refToUid, refItem);
                        }
                    }
                }
            }
        }
    };

    /**
     * On evict remove all pointers and references to this entity.
     *
     * @param entityUid
     * @param flushMap
     */
    const clearParentRefTos = (entityUid, flushMap) => {
        let item = getItemFlushOrAlive(entityUid, flushMap);

        if (item) {
            let refFrom = item[REF_FROM];
            for (let parentUid in refFrom) {
                if (refFrom.hasOwnProperty(parentUid)) {
                    let parentItem = getItemFlushOrAlive(parentUid, flushMap);
                    if (parentItem) {
                        let success = clearRefTo(parentItem, entityUid);
                        if (success === true) {
                            flushMap.set(parentUid, parentItem);
                        }
                    }
                }
            }
        }
    };

    const getItemFlushOrAlive = (uid, flushMap) => {
        if (!uid) {
            return;
        }
        uid      = String(uid);
        let item = flushMap.get(uid);
        if (!item) {
            item = getLiveItem(uid);
        }
        if (Object.isFrozen(item)) {
            item = cloneItem(item);
        }
        return item;
    };

    /**
     * Checks the refTo metadata to ensure that all referenced items are still in this entity.
     *
     * @param entityUid the entity to be checked for refTo integrity
     * @param flushMap
     * @param evictMap map of potentially deletable items in case all references have been removed
     */
    const updateRefTos = (entityUid, flushMap, evictMap) => {
        let item = getItemFlushOrAlive(entityUid, flushMap);
        if (item) {
            let refTo = item[REF_TO];
            // check the references for each referenced item. References are keyed by refToUid in the refTo object.
            // Each refToUid value is an array containing a list of paths where the reference is located inside this
            // entity
            for (let refToUid in refTo) {
                if (refTo.hasOwnProperty(refToUid)) {
                    // get the list of paths
                    let paths = refTo[refToUid];
                    // update the paths array to contain only the remaining references
                    let updatedPaths = paths.map(path => {
                        let reference = opath.get(item[ENTITY], path);
                        if (reference) {
                            let targetUid = reference[config.prop.uidName];
                            if (targetUid) {
                                // *** keep double equality here to convert strings to numbers
                                let found = targetUid == refToUid;
                                if (found === true) {
                                    return path;
                                }
                            }
                        }
                        removeRefFrom_Value(entityUid, refToUid, path, flushMap, evictMap);
                    }).filter(item => {
                        return item !== null && item !== undefined;
                    });

                    // update or remove the paths
                    if (updatedPaths.length > 0) {
                        item[REF_TO][refToUid] = updatedPaths;
                    } else {
                        item[REF_TO][refToUid] = undefined;
                        delete item[REF_TO][refToUid];
                    }
                }
            }
        }
    };

    const freezeItem = item => {
        Object.freeze(item);
        Object.freeze(item[ENTITY]);
        Object.freeze(item[REF_TO]);
        Object.freeze(item[REF_FROM]);
    };

    /**
     * Removes a path value from an item's ref_from metadata. It places it either on the flush map if it was updated or
     * the evict map if there are no references left over.
     *
     * @param parentUid uid of the entity holding the reference that might have been changed
     * @param refUid uid of the entity being referenced
     * @param path path in the parent entity where the referenced entity is located
     * @param flushMap map of updated items to be persisted into the cache
     * @param evictMap map of updated items to be removed from the cache
     */
    const removeRefFrom_Value = (parentUid, refUid, path, flushMap, evictMap) => {
        // get the item of the referenced entity
        let refItem = getItemFlushOrAlive(refUid, flushMap);
        if (refItem) {
            // make a new instance (pure function)
            refItem = Object.assign({}, refItem);
            cloneRef(refItem, REF_FROM);
            // remove the path from the refFrom
            if (refItem[REF_FROM].hasOwnProperty(parentUid)) {
                // get the array of refs
                removeRefFrom(refItem, parentUid, path);
                if (refItem[REF_FROM].length === 0) {
                    evictMap.set(refUid, refItem);
                    // just in case
                    flushMap.delete(refUid);
                } else {
                    flushMap.set(refUid, refItem);
                    // just in case
                    evictMap.delete(refUid);
                }
            }
        }
    };

    /**
     * Clones an item's reference object for pure functionality
     *
     * @param item
     * @param refName
     */
    const cloneRef = (item, refName) => {
        let length           = item[refName].length;
        item[refName]        = Object.assign(getNewLengthObj(), item[refName]);
        item[refName].length = length;
    };

    /**
     * Adds ref_to metadata to a parent item that contains a referenced uid entity.
     *
     * @param {{}} parentItem the item of the parent entity
     * @param {string} refUid the uid of the referenced entity
     * @param {string} path the path inside the parent entity where the referenced entity is located
     * @returns {{}} the parentItem just in case it was cloned for purity
     */
    const addRefTo = (parentItem, refUid, path) => {
        let refTo = parentItem[REF_TO];
        if (!parentItem[REF_TO][refUid]) {
            parentItem[REF_TO][refUid] = [];
            parentItem[REF_TO].length += 1;
        }
        let refArray = refTo[refUid];
        if (refArray.indexOf(path) < 0) {
            refArray.push(path);
        }
        return parentItem;
    };

    /**
     * Adds ref_from metadata to a referenced item that is contained in the parent entity.
     *
     * @param {{}} refItem the item of the referenced entity
     * @param {string} parentUid the uid of the parent entity
     * @param {string} path the path inside the parent entity where the referenced entity is located
     */
    const addRefFrom = (refItem, parentUid, path) => {
        let refFrom = refItem[REF_FROM];
        if (!refItem[REF_FROM][parentUid]) {
            refItem[REF_FROM][parentUid] = [];
            refItem[REF_FROM].length += 1;
        }
        let fromArray = refFrom[parentUid];
        if (fromArray.indexOf(path) < 0) {
            fromArray.push(path);
        }
        return refItem;
    };

    const removeRefFrom = (item, parentUid, path) => {
        let refsArray = item[REF_FROM][parentUid];

        let index = refsArray.indexOf(path);

        // make an editable copy
        refsArray = refsArray.slice();
        refsArray.splice(index, 1);
        item[REF_FROM][parentUid] = refsArray;
        if (refsArray.length == 0) {
            item[REF_FROM][parentUid] = undefined;
            delete item[REF_FROM][parentUid];
            item[REF_FROM].length -= 1;
        }
    };

    /**
     * Clears all references from a specific parent when it is being evicted.
     *
     * @param refItem
     * @param parentUid
     */
    const clearRefFrom = (refItem, parentUid) => {
        let refsArray = refItem[REF_FROM][parentUid];
        if (!refsArray) {
            return;
        }
        cloneRef(refItem, REF_FROM);
        refItem[REF_FROM][parentUid] = undefined;
        delete refItem[REF_FROM][parentUid]; // where it works
        if (refItem[REF_FROM].length > 0) {
            refItem[REF_FROM].length -= 1;
        }
    };

    /**
     * Clears all
     *
     * @param parentItem
     * @param refUid
     */
    const clearRefTo = (parentItem, refUid) => {
        // first remove all instances of entity from the parent
        let parent = parentItem[ENTITY];
        if (Object.isFrozen(parent)) {
            parent             = getEdit(parent[config.prop.uidName]);
            parentItem[ENTITY] = parent;
        }
        let refPaths = parentItem[REF_TO][refUid];
        refPaths.forEach(path => {
            opath.del(parent, path);
        });
        if (!Object.isFrozen(parent)) {
            Object.freeze(parent);
        }
        parentItem[ENTITY] = parent;

        // then clear the metadata
        cloneRef(parentItem, REF_TO);
        parentItem[REF_TO][refUid] = undefined;
        delete parentItem[REF_TO][refUid]; // where it works

        if (parentItem[REF_TO].length > 0) {
            parentItem[REF_TO].length -= 1;
        }
        return true;
    };

    /**
     * Once an object is processed to be placed into the cache it must be removed from the pending shallow put array
     * else the get operation will return it from there.
     * @param uid
     */
    const removeFromQueue = uid => {
        if (putQueue[uid]) {
            putQueue[uid] = undefined;
            //delete putQueue[uid];
            if (putQueue.length > 0) {
                putQueue.length -= 1;
            }
        }
    };

    /**
     * Caches the refs that might be contained in a javascript object that optionally has a uid property. Loops through
     * each property to find the appropriate ones.
     *
     * @param parentEntity
     * @param flushMap
     * @param parentUid
     * @param evictMap
     * @param refPath the path of the referenced uid entity inside its parent
     */
    const cacheEntityRefs = (parentEntity, flushMap, parentUid, evictMap, refPath = "", strong) => {
        for (let prop in parentEntity) {
            if (parentEntity.hasOwnProperty(prop)) {
                refPath       = concatProp(refPath, prop);
                let refEntity = parentEntity[prop];

                if (isArray(refEntity)) {
                    cacheArrRefs(refEntity, flushMap, parentUid, evictMap, refPath, strong);
                } else if (isObject(refEntity)) {
                    // abort on weak puts if item exists
                    if(strong === false && getLiveItem(refEntity[config.prop.uidName])){
                        return;
                    }
                    cacheObjRefs(refEntity, flushMap, parentUid, evictMap, refPath, strong);
                }
                Object.freeze(refEntity);
            }
            refPath = "";
        }
    };

    /**
     * Checks whether an exact entity is already cached.
     *
     * @param entity
     * @param threadId
     * @param strong
     * @returns {boolean}
     */
    const isOnCache = (entity) => {
        // this is only called for uid items so ok not to check for uid
        let uid          = entity[config.prop.uidName];
        let existingItem = getLiveItem(uid);
        return existingItem && existingItem[ENTITY] === entity;
    };

    /**
     * Caches the refs that might be contained in a single javascript object.
     *
     * @param refEntity
     * @param flushMap
     * @param parentUid
     * @param evictMap
     * @param refPath
     */
    const cacheObjRefs = (refEntity, flushMap, parentUid, evictMap, refPath = "", strong) => {
        if (hasUid(refEntity)) {
            // abort if weak and existing
            if(strong === false && getLiveItem(refEntity[config.prop.uidName])){
                return;
            }

            // if the refEntity has an uid it means that we're at the end of the refPath and must assign all ref info
            // into the entity's item
            let refItem = ensureItem(refEntity, flushMap);
            if (refItem) {
                assignRefToParent(refItem, parentUid, refPath, flushMap);
                let exists = isOnCache(refEntity);
                if (exists === true) {
                    // not iterating inside it as it's the same as cached
                    return;
                }
                refItem[ENTITY] = refEntity;
                parentUid       = String(refEntity[config.prop.uidName]);
                buildFlushMap(refEntity, flushMap, parentUid, evictMap, refPath, strong);
            }
        } else {
            // go deeper down the non uid rabbit hole - keep building the refPath
            cacheEntityRefs(refEntity, flushMap, parentUid, evictMap, refPath, strong);
        }
        Object.freeze(refEntity);
    };

    const assignRefToParent = (refItem, parentUid, refPath, flushMap) => {
        let parentItem = getItemFlushOrAlive(parentUid, flushMap);
        if (parentItem && refPath && refPath !== "") {
            assignRefs(parentItem, refItem, refPath);
        }
    };

    /**
     * Caches the refs that might be contained in an array.
     *
     * @param entity
     * @param flushMap
     * @param parentUid
     * @param evictMap
     * @param refPath
     */
    const cacheArrRefs = (entity, flushMap, parentUid, evictMap, refPath = "", strong) => {
        let path;
        entity.forEach((item, index) => {
            path = refPath + "." + index;
            if (isArray(item)) {
                cacheArrRefs(item, flushMap, parentUid, evictMap, path, strong);
            } else if (isObject(item)) {
                cacheObjRefs(item, flushMap, parentUid, evictMap, path, strong);
            }
        });
        Object.freeze(entity);
    };

    // when caching props must keep track of all uid objects embedded inside the entity. This is because if a new
    // version of the entity is saved and those objects have been removed the cache pointer references must also be
    // updated. In order to do this efficiently every entity's item must keep a map of each referenced object it
    // contains. The map (an object really) keeps track of the referenced object's uid (the key) AND the path to where
    // the entity is located inside the parent. Since all cache data is immutable this doesn't change.

    /**
     * Records the dependencies of a uid entity (in refItem) to its containing uid entity (in parentItem).
     * @param parentItem cache item of the entity containing the reference
     * @param refItem cache item of the reference entity
     * @param refPath the concatenated path of the ref entity inside the parent entity
     */
    const assignRefs = (parentItem, refItem, refPath) => {
        let parentUid = parentItem[ENTITY][config.prop.uidName];
        let refUid    = refItem[ENTITY][config.prop.uidName];

        // add parent reference to child
        addRefTo(parentItem, refUid, refPath);
        addRefFrom(refItem, parentUid, refPath);
    };

    /**
     *
     * @param propChain
     * @param prop
     */
    const concatProp = (propChain, prop) => {
        if (propChain === "") {
            propChain = prop;
        } else {
            propChain = propChain + "." + prop;
        }
        return propChain;
    };

    /**
     *
     * @returns {Map}
     */
    const getCurrentMainStack = () => {
        let currentMainNode = getCurrentNode();
        return currentMainNode ? currentMainNode.items : new Map();
    };

    /**
     * For items that are unique in context all references on the map must point to the same single object. In order to
     * prevent the map from replicating itself on each set operation this must be executed with mutations thus
     * adding all items on the same mutating instance of the map. All items to be added must have been previously
     * collected in the array.
     * @param flushArray array of items to be put into the cache
     * @param evictMap map of items that were de-referenced and should be removed from the next cache node
     */
    const addItems = (flushArray, evictMap) => {
        // get a copy of the current nodes
        let temp         = new Map();
        let currentStack = getCurrentMainStack();
        currentStack.forEach((value, key) => {
            temp.set(key, value);
        });

        flushArray.forEach(item => {
            // track the uid of the item being changed and referencing the items.
            let itemUid = item[ENTITY][config.prop.uidName];
            freezeItem(item);
            temp.set(String(itemUid), item);
        });

        if (evictMap.size > 0) {
            evictMap.forEach((value, key) => {
                temp.delete(String(key));
            });
        }

        flush(temp);
    };

    // GET UTILS
    /**
     *
     * @param uidOrEntity
     * @param {string} threadId
     * @returns {*}
     */
    const getObject = (uidOrEntity) => {
        let realUid = getActualUid(uidOrEntity);
        if (!realUid) {
            return;
        }

        let item = getLiveItem(realUid);
        if (item === undefined) {
            // if we have it in the putQueue map return that one.
            let queued = putQueue[realUid];
            if (queued) {
                return queued;
            }
            return;
        }
        return item[ENTITY];
    };

    /**
     * Extracts the uid from a parameter that can be either the uid directly or an entity with a uid prop,
     * @param uidOrEntity
     * @returns {*}
     */
    const getActualUid = uidOrEntity => {
        if (typeof uidOrEntity === "string") {
            return uidOrEntity;
        } else if (typeof uidOrEntity === "number") {
            return String(uidOrEntity);
        }
        else if (isObject(uidOrEntity)) {
            if (hasUid(uidOrEntity)) {
                return uidOrEntity[config.prop.uidName];
            }
        }
    };

    /**
     *
     * @param uidOrEntityOrArray
     */
    const getEdit = uidOrEntityOrArray => {
        if (isArray(uidOrEntityOrArray)) {
            return uidOrEntityOrArray.map(item => {
                return getEditableObject(item);
            }).filter(item => {
                return item !== null & item !== undefined;
            })
        }
        return getEditableObject(uidOrEntityOrArray);
    };

    /**
     * Gets or set the current index of the cache. If no value is provided it returns the current index. If a value is
     * provided it sets the current index to the given value if it is an integer within the cache's length.
     *
     * * @param idx
     * @returns {number|boolean} the current index in the nodes order, or when setting the index, true if the index has
     *     changed, false otherwise
     */
    const index = idx => {
        // just in case
        if (isNumber(idx) === true) {
            if (mainThread.current !== idx) {
                if (idx >= 0 && idx < length()) {
                    mainThread.current = idx;
                } else {
                    throw new TypeError("Index out of bounds");
                }
                notify();
                return true;
            }
            return false;
        }
        // for any other argument or no arg return the current index value
        return mainThread.current;
    };

    /**
     * Gets or sets the current position of the cache by node id. Using index() is not always reliable in case some
     * nodes are deleted to clear up memory. Node is more reliable in terms of getting the id of a node that can be
     * checked for existence.
     *
     * @param nodeId the id of the node to navigate to if applicable
     * @returns {*} for node() - the id of the node if existing or -1 if cache is empty, for node(id) the current
     *     history state
     */
    const node = nodeId => {
        // guard for 0 values
        if (typeof nodeId === "undefined") {
            let currentNode = getCurrentNode();
            return currentNode ? currentNode.id : -1;
        }

        if (!isNumber(nodeId)) {
            throw new TypeError("The node id must be a number.");
        }

        let cacheNode = getRepoNode(nodeId);
        if (!cacheNode) {
            return getHistoryState(false);
        }
        mainThread.current = binaryIndexOf(mainThread.nodes, nodeId);
        return getHistoryState(true);
    };

    /**
     * Performs a binary search on the array argument O(log(n)). Use to search for item in the main stack which is
     * sorted.
     *
     * @param {[]} array The sorted array to search on.
     * @param {*} searchElement The item to search for within the array.
     * @return {Number} The index of the element which defaults to -1 when not found.
     *
     * http://oli.me.uk/2013/06/08/searching-javascript-arrays-with-a-binary-search/
     */
    function binaryIndexOf(array, searchElement) {
        var minIndex = 0;
        var maxIndex = array.length - 1;
        var currentIndex;
        var currentElement;

        while (minIndex <= maxIndex) {
            currentIndex   = (minIndex + maxIndex) / 2 | 0;
            currentElement = array[currentIndex];

            if (currentElement < searchElement) {
                minIndex = currentIndex + 1;
            }
            else if (currentElement > searchElement) {
                maxIndex = currentIndex - 1;
            }
            else {
                return currentIndex;
            }
        }
        /* istanbul ignore next - it never gets here really*/
        return -1;
    }

    /**
     *  Gets a shallow copy of the object maintaining all the deep uid references intact (keep identity) so that ui
     * children to not get refreshed needlessly when changing a property on the parent. Note that the children will
     * be frozen so if needing to change a child must get it editable separately.
     * @param uidOrEntity
     * @returns {*}
     */
    const getEditableObject = (uidOrEntity) => {
        let realUid = getActualUid(uidOrEntity);
        if (getQueued(realUid)) {
            return putQueue[realUid];
        }

        let existing = get(realUid);
        if (!existing) {
            return;
        }
        return deepClone(existing, undefined, false);
    };

    /**
     * Guarantees that the entity's item is present on the flush map and returns it.
     *
     * @param entity
     * @param flushMap
     * @returns {*} an editable item corresponding to the entity on the flush map.
     */
    const ensureItem = (entity, flushMap) => {
        let itemUid = String(entity[config.prop.uidName]);
        let item    = flushMap.get(itemUid);
        if (item) {
            return item;
        }

        // else make a copy of the live item
        item         = {};
        let live     = getLiveItem(itemUid);
        item[ENTITY] = entity;
        if (live !== undefined) {
            item = Object.assign(item, live);
            // must reset the entity here so it displays at the top but is not the old one
            item[ENTITY] = entity;

            // each path is an array of strings so they get duplicated automatically
            item[REF_FROM]        = Object.assign(getNewLengthObj(), live[REF_FROM]);
            item[REF_FROM].length = live[REF_FROM].length;

            item[REF_TO]        = Object.assign(getNewLengthObj(), live[REF_TO]);
            item[REF_TO].length = live[REF_TO].length;
        } else {
            item[REF_FROM] = getNewLengthObj();
            item[REF_TO]   = getNewLengthObj();
        }
        flushMap.set(itemUid, item);
        flushMap.set(UPDATED_KEY, true);
        removeFromQueue(itemUid);
        return item;
    };

    const cloneItem = item => {
        let newItem = Object.assign({}, item);
        cloneRef(newItem, REF_FROM);
        cloneRef(newItem, REF_TO);
        return newItem;
    };

    /**
     * Whether the current version of the cache contains a specific item.
     * @returns {boolean}
     */
    const contains = obj => {
        if (!hasUid(obj)) {
            // items are stored by uid
            return false;
        }
        return (typeof getLiveItem(obj[config.prop.uidName]) !== "undefined");
    };

    /**
     * Selects the previous version of the cache from the nodes.
     *
     * @returns {{}}
     */
    const undo = () => {
        let success = false;
        if (hasPrev()) {
            mainThread.current -= 1;
            success = true;
        }
        return getHistoryState(success);
    };

    /**
     * Selects the next version of the cache from the nodes.
     *
     * @returns {{}}
     */
    const redo = () => {
        let success = false;
        if (hasNext()) {
            mainThread.current += 1;
            success = true;
        }
        return getHistoryState(success);
    };

    /**
     * Gets the state of the cache.
     * @param success The outcome of a cache operation
     * @param threadId optional thread id to request the cache history state for a specific thread
     * @returns {{}}
     */
    const getHistoryState = (success) => {
        let result     = {};
        result.success = success;
        result.index   = index();
        result.node    = node();
        result.length  = length();
        result.hasPrev = result.index > 0;
        result.hasNext = result.index < (result.length - 1);
        return result;
    };

    /**
     * Has a next state to redo to.
     */
    const hasNext = () => {
        return mainThread.current < (mainThread.nodes.length - 1);
    };

    /**
     * Has a previous state to undo to.
     */
    const hasPrev = () => {
        return mainThread.current > 0;
    };

    /**
     * Number of entities currently stored in the cache.
     * @returns {*}
     */
    const size = () => {
        let cacheNode = getCurrentNode();
        return cacheNode ? cacheNode.items.size : 0;
    };

    /**
     * Number of current cache versions stored in the history nodes.
     * @returns {Number}
     */
    const length = () => {
        return mainThread.nodes.length;
    };

    const pending = () => {
        return {
            queue: putQueue.length
        }
    };

    // -----------------

    /**
     * Removes the nodes after the current node in order to repurpose history if user undoes and chooses another
     * direction
     *
     * @param threadId
     */
    const clearNext = () => {
        // clear all nodes after this one
        if (mainThread.current < mainThread.nodes.length - 1) {
            let removedNodes   = mainThread.nodes.slice(mainThread.current + 1, mainThread.nodes.length);
            mainThread.nodes   = mainThread.nodes.slice(0, mainThread.current + 1);
            mainThread.current = mainThread.nodes.length - 1;
            truncateThreads(removedNodes);
        }
    };

    /**
     *
     * @param removedNodes array of nodes that are being removed from the main thread
     */
    const truncateThreads = removedNodes => {
        removedNodes.forEach(cacheNodeId => {
            let cacheNode = repo.get(cacheNodeId);
            if (cacheNode) {
                repo.delete(cacheNodeId);
            }
        });
    };

    /**
     * The cache might have a series of intermediary steps that do not need to be persisted to the nodes. Flush
     * pushes the current state into the nodes once all atomic changes for a single merge have happened.
     *
     * @param temp
     * @param threadIds
     */
    const flush = (temp, threadIds) => {
        if (temp !== null) {
            Object.freeze(temp);
            let cacheNode   = getNewCacheNode();
            cacheNode.items = temp;

            if (mainThread.nodes.indexOf(cacheNode.id) < 0) {
                mainThread.nodes.push(cacheNode.id);
                mainThread.current += 1;
            }
        }
    };

    /**
     * Pulls an item out of the current version of the cache. Gets the actual real instance but frozen (uneditable).
     * Useful for testing.
     * @param uid
     * @returns {*}
     */
    const getLiveItem = uid => {
        let currentNode = getCurrentNode();
        return currentNode ? currentNode.items.get(String(uid)) : undefined;
    };

    /**
     * The node currently being displayed by the cache.
     *
     * @param threadId
     * @returns {undefined} the cache node that the thread is currently left pointing at.
     */
    function getCurrentNode() {
        let currentNodeId = mainThread.nodes[mainThread.current];
        // watch out currentNodeId evaluates to false when it's 0
        return currentNodeId >= 0 ? getRepoNode(currentNodeId) : undefined;
    }

    function getRepoNode(cacheNodeId) {
        return repo.get(cacheNodeId);
    }

    // ----------------------------------

    const print = () => {
        let result  = "";
        let index   = 0;
        let current = mainThread.current;
        mainThread.nodes.map(cacheNodeId => {
            let streamData = "";
            let cacheNode  = repo.get(cacheNodeId);
            let state      = index + ":" + streamData + "\n[" + stringifyMap(cacheNode.items) + "],\n\n";
            // let state = index + ":" + streamData + "\n" + JSON.stringify(repo[cacheNode].items) + ",\n\n";
            if (index === current) {
                state = "-> " + state;
            }
            result += state;
            index++;
        });

        result = result.substring(0, (result.length - 2));

        index = 0;

        console.log("\n------ One -------"
            + "\nSTACK:\n" + result
            + "\n\nCONFIG:" + JSON.stringify(config, null, 2)
            + "\n\nQUEUE:" + JSON.stringify(putQueue, null, 2)
            + "\n\nHISTORY:" + JSON.stringify(getHistoryState(), null, 2)
            + "\n\nREPO SIZE:" + repo.size
            + "\n===================\n");
    };

    const stringifyMap = map => {
        let result = "";
        let arr    = [...map.values()];

        arr.map(item => {
            let itemResult;
            // this try catch is for cyclical data testing
            //            try {
            itemResult = JSON.stringify(item, null, 2) + ",\n";
            //} catch (err) {
            //    console.log("CYCLICAL STRUCTURE - to fix: " + err.message);
            //    return;
            //}

            if (itemResult.indexOf(REF_FROM) >= 0 && item[REF_FROM]) {
                itemResult = itemResult.replace('"' + REF_FROM + '": {}', '"' + REF_FROM + '"' + ": " + JSON.stringify([...item[REF_FROM]]));
            }
            if (itemResult.indexOf(REF_TO) >= 0 && item[REF_TO]) {
                itemResult = itemResult.replace('"' + REF_TO + '": {}', '"' + REF_TO + '"' + ": " + JSON.stringify(item[REF_TO]));
            }
            result += itemResult;
        });

        if (result.length > 2) {
            result = result.substring(0, result.length - 2);
        }
        return result;
    };

    /**
     * Quick identity check to see if the entity instance is present in the cache.
     * @param {{}} uidEntity
     * @param {string} threadId id of the thread on which the entity is compared for identity
     * @returns {boolean}
     */
    const isDirty = uidEntity => {
        if (!hasUid(uidEntity)) {
            return true;
        }
        let uid      = uidEntity[config.prop.uidName];
        let existing = get(uid);
        if (!existing) {
            return true;
        }
        return existing !== uidEntity;
    };

    const subscribe = callback => {
        listeners.push(callback);
        var isSubscribed = true;

        return function unsubscribe() {
            if (!isSubscribed) {
                return;
            }
            isSubscribed = false;
            var index    = listeners.indexOf(callback);
            listeners.splice(index, 1)
        }
    };

    /**
     * Call all the listeners in order to notify them of a state change.
     * @param {Array} modified list of uid of entities that have been modified - if applicable.
     */
    const notify = modified => {
        listeners.slice().forEach(listener => {
            listener(modified);
        });
    };

    // UUID
    var lut = [];
    for (var i = 0; i < 256; i++) {
        lut[i] = (i < 16 ? '0' : '') + (i).toString(16);
    }

    // GUID generator http://jsperf.com/uuid-generator-opt/8
    const createUUid = () => {
        var d0 = Math.random() * 0x100000000 | 0;
        var d1 = Math.random() * 0x100000000 | 0;
        var d2 = Math.random() * 0x100000000 | 0;
        var d3 = Math.random() * 0x100000000 | 0;
        return lut[d0 & 0xFF] + lut[d0 >> 8 & 0xFF] + lut[d0 >> 16 & 0xFF]
            + lut[d0 >> 24 & 0xFF] + '-' + lut[d1 & 0xFF]
            + lut[d1 >> 8 & 0xFF] + '-' + lut[d1 >> 16 & 0x0f | 0x40]
            + lut[d1 >> 24 & 0xFF] + '-' + lut[d2 & 0x3f | 0x80]
            + lut[d2 >> 8 & 0xFF] + '-' + lut[d2 >> 16 & 0xFF]
            + lut[d2 >> 24 & 0xFF] + lut[d3 & 0xFF] + lut[d3 >> 8 & 0xFF]
            + lut[d3 >> 16 & 0xFF] + lut[d3 >> 24 & 0xFF];
    };

    const refFrom = uid => {
        let item = getLiveItem(uid);
        return item[REF_FROM];
    };

    const refTo = uid => {
        let item = getLiveItem(uid);
        return item[REF_TO];
    };

    // API
    let base = {
        // put/get
        put    : put,
        get    : get,
        getEdit: getEdit,
        evict  : evict,
        reset  : reset,

        // queue
        queue     : queue,
        unQueue   : unqueue,
        queueEvict: queueEvict,
        getQueued : getQueued,
        commit    : commit,

        // time travel
        undo           : undo,
        redo           : redo,
        index          : index,
        node           : node,
        getHistoryState: getHistoryState,

        // utils
        isDirty  : isDirty,
        uuid     : createUUid,
        contains : contains,
        config   : setConfig,
        subscribe: subscribe
    };

    if (debugParam === true) {
        base.getCurrentNode = getCurrentNode;

        base.refFrom = refFrom;
        base.refTo   = refTo;

        // dimensions
        base.size = size; // number of items in the current state
        base.length = length; // number of states in the cache
        base.pending = pending; // number of pending operations by type
        base.print = print;
    }

    return base;
}
