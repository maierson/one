/**
 * Created by danmaier on 4/27/16.
 * Only need get, del from
 * https://github.com/mariocasciaro/object-path
 */

import { isArray, isEmpty, isNumber, isString } from './util'

function getKey(key) {
  var intKey = parseInt(key)
  if (intKey.toString() === key) {
    return intKey
  }
  return key
}

export function del(obj: any, path?) {
  if (isNumber(path)) {
    path = [path]
  }

  if (isEmpty(obj)) {
    return void 0
  }

  if (isEmpty(path)) {
    return obj
  }
  if (isString(path)) {
    return del(obj, path.split('.'))
  }

  var currentPath = getKey(path[0])
  var oldVal = obj[currentPath]

  if (path.length === 1) {
    if (oldVal !== void 0) {
      if (isArray(obj)) {
        obj.splice(currentPath, 1)
      } else {
        delete obj[currentPath]
      }
    }
  } else {
    if (obj[currentPath] !== void 0) {
      return del(obj[currentPath], path.slice(1))
    }
  }

  return obj
}

export function get(obj: any, path: any, defaultValue?: any): any {
  if (isNumber(path)) {
    path = [path]
  }
  if (isEmpty(path)) {
    return obj
  }
  if (isEmpty(obj)) {
    return defaultValue
  }
  if (isString(path)) {
    return get(obj, path.split('.'), defaultValue)
  }

  var currentPath = getKey(path[0])

  if (path.length === 1) {
    if (obj[currentPath] === void 0) {
      return defaultValue
    }
    return obj[currentPath]
  }

  return get(obj[currentPath], path.slice(1), defaultValue)
}
