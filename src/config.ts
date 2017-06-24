/**
 * Cache configurable properties.
 * Created by maierdesign on 1/19/16.
 */
export const defaultConfig = {
  uidName: 'uid',
  maxHistoryStates: 1000,
}

/**
 * @param conf Json object containing overrides for any of the configurable properties.
 */
export function configure(conf) {
  for (let p in defaultConfig) {
    if (defaultConfig.hasOwnProperty(p) && conf.hasOwnProperty(p)) {
      defaultConfig[p] = conf[p]
    }
  }
  return defaultConfig
}
