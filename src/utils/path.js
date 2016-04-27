/**
 * Created by danmaier on 4/27/16.
 * Only need get, del from
 * https://github.com/mariocasciaro/object-path
 */
"use strict";

import {isObject, isArray} from './clone';

var _hasOwnProperty = Object.prototype.hasOwnProperty;

function isNumber(value) {
    return typeof value === 'number' || toString(value) === "[object Number]";
}

function isString(obj) {
    return typeof obj === 'string' || toString(obj) === "[object String]";
}

function isEmpty(value) {
    if (!value) {
        return true;
    }
    if (isArray(value) && value.length === 0) {
        return true;
    } else if (!isString(value)) {
        for (var i in value) {
            if (_hasOwnProperty.call(value, i)) {
                return false;
            }
        }
        return true;
    }
    return false;
}

function getKey(key) {
    var intKey = parseInt(key);
    if (intKey.toString() === key) {
        return intKey;
    }
    return key;
}

export function del(obj, path) {
    if (isNumber(path)) {
        path = [path];
    }

    if (isEmpty(obj)) {
        return void 0;
    }

    if (isEmpty(path)) {
        return obj;
    }
    if (isString(path)) {
        return del(obj, path.split('.'));
    }

    var currentPath = getKey(path[0]);
    var oldVal      = obj[currentPath];

    if (path.length === 1) {
        if (oldVal !== void 0) {
            if (isArray(obj)) {
                obj.splice(currentPath, 1);
            } else {
                delete obj[currentPath];
            }
        }
    } else {
        if (obj[currentPath] !== void 0) {
            return del(obj[currentPath], path.slice(1));
        }
    }

    return obj;
}

export function get(obj, path, defaultValue) {
    if (isNumber(path)) {
        path = [path];
    }
    if (isEmpty(path)) {
        return obj;
    }
    if (isEmpty(obj)) {
        return defaultValue;
    }
    if (isString(path)) {
        return get(obj, path.split('.'), defaultValue);
    }

    var currentPath = getKey(path[0]);

    if (path.length === 1) {
        if (obj[currentPath] === void 0) {
            return defaultValue;
        }
        return obj[currentPath];
    }

    return get(obj[currentPath], path.slice(1), defaultValue);
}

