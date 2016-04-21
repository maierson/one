"use strict";
/**
 * Cache configurable properties.
 * Created by maierdesign on 1/19/16.
 */
export const prop = {
    uidName         : "uid",
    maxHistoryStates: 1000
};

/**
 * @param conf Json object containing overrides for any of the configurable properties.
 */
export function config(conf) {
    for (let p in prop) {
        if (prop.hasOwnProperty(p) && conf.hasOwnProperty(p)) {
            prop[p] = conf[p];
        }
    }
}
