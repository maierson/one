/**
 * Created by maierdesign on 1/19/16.
 */

/**
 * Deeply freezes an object recursively.
 * https://github.com/substack/deep-freeze
 */
export default function deepFreeze(obj) {
    if (!obj) {
        return;
    }

    Object.freeze(obj);

    Object.getOwnPropertyNames(obj).forEach(function (prop) {
        if (obj.hasOwnProperty(prop)
            && obj[prop] !== null
            && (typeof obj[prop] === "object" || typeof obj[prop] === "function")
            && !Object.isFrozen(obj[prop])) {
            deepFreeze(obj[prop]);
        }
    });

    return obj;
};


