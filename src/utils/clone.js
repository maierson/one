/**
 * Created by maierdesign on 1/19/16.
 */
import * as config from './config';

/**
 *
 * @param {Object} obj object to be cloned
 * @param {Object} uidReference optional uid entity to be replaced inside the item because of having been updated
 * @param freeze set to false if the items should not be frozen upon cloning = getEdit()
 * @param force
 * @returns {*}
 */
export function deepClone(obj, uidReference, freeze = true, force = false) {
    if (!obj || (!isObject(obj) && !isArray(obj))) {
        return obj;
    }

    if (freeze && uidReference && !Object.isFrozen(uidReference)) {
        Object.freeze(uidReference);
    }

    // the uid reference is already cloned here - safe to return
    if (uidReference && hasUid(obj) && obj[config.prop.uidName] === uidReference[config.prop.uidName]) {
        return uidReference;
    }

    // shallow copy first
    let result = Object.assign({}, obj);
    var propName;
    for (propName in result) {
        if (result.hasOwnProperty(propName)) {
            let value = result[propName];
            if (value) {
                if (isArray(value)) {
                    result[propName] = deepCloneArray(value, uidReference, force);
                } else if (isDate(value)) {
                    let date = new Date(value.getTime());
                    if (freeze) {
                        Object.freeze(date);
                    }
                    result[propName] = date;
                } else if (isObject(value)) {
                    if (hasUid(value)) {
                        result[propName] = value;
                        if (uidReference && hasUid(uidReference)) {
                            if (value !== uidReference
                                && value.uid === uidReference.uid
                                && value !== uidReference) {
                                result[propName] = uidReference;
                            }
                        } else {
                            // do nothing here - keep the uid reference - not editable
                            //result[propName] = deepClone(value);
                        }
                    } else {
                        result[propName] = deepClone(value, uidReference, freeze, force);
                    }
                }
            }
        }
    }
    if (freeze && !Object.isFrozen(result)) {
        Object.freeze(result);
    }
    return result;
}

function deepCloneArray(arr, uidReference, force) {
    return arr.map(item => {
        if (isArray(item)) {
            return deepCloneArray(item, uidReference, force);
        } else if (isObject(item)) {
            if (hasUid(item) && force === false) {
                return item;
            } else {
                return deepClone(item, uidReference, true, force);
            }
        } else {
            return item;
        }
    });
}

export function hasUid(obj) {
    //console.log("DEBUG HAS UID " + obj[config.prop.uidName] + " " + JSON.stringify(obj));
    if (!obj) {
        return false;
    }
    if (!isObject(obj)) {
        return false;
    }
    if (typeof obj[config.prop.uidName] === "undefined") {
        return false;
    }
    let uid = obj[config.prop.uidName];
    return uid.length !== 0;
};

/**
 * Copies a set's values into another set (shallow)
 * @param set
 */
export function cloneSet(set) {
    let prevSet = set || new Set();
    return new Set([...prevSet]);
}

/**
 * Checks if argument is an object
 * @param mixed_var
 * @returns {boolean}
 */
export function isObject(mixed_var) {
    if (Object.prototype.toString.call(mixed_var) === '[object Array]') {
        return false;
    }
    // javascript considers null to be an object so excluding null here
    // would cause all existing properties to be replaced by null
    // if such property existed and was null on the incoming object
    return mixed_var !== null && typeof mixed_var === 'object';
};

/**
 * checks if argument is an array
 */
export function isArray(value) {

    if (!value || value === null) {
        return false;
    }
    // Douglas Crockford JavascriptTheGoodParts pge.61
    // works across iFrames
    return Array.isArray(value) || (
            value && typeof value === 'object'
            && typeof value.length === 'number'
            && typeof value.splice === 'function'
            && !(value.propertyIsEnumerable('length'))
        );
};

/**
 *
 * @param o
 * @returns {string}
 */
function objToStr(o) {
    return Object.prototype.toString.call(o);
}

/**
 *
 * @param value
 * @returns {boolean}
 */
export function isDate(value) {
    return isObject(value) && objToStr(value) === '[object Date]';
}

/**
 *
 * @param value
 * @returns {boolean}
 */
export function isRegExp(value) {
    return isObject(value) && objToStr(value) === '[object RegExp]';
}

