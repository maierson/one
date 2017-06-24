import 'jest'

import * as One from '../src/cache'
import * as path from '../src/path'

import { cacheSize, deepClone, isArray } from '../src/util'

import CacheMap from '../src/CacheMap'
import { configure } from '../src/config'

describe('setup', function () {
  One.setTesting(false)

  it('should put to default cache', function () {
    let item = { uid: 1 }
    One.put(item)
    let result = One.get(1)
    expect(result).toBeDefined()
    expect(result).toBe(item)
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('should getEdit from default cache', () => {
    let item = { uid: 1 }
    One.put(item)
    let result = One.getEdit(1)
    expect(result).toBeDefined()
    expect(result === item).toBe(false)
  })

  it('should evict from default cache', () => {
    One.put({ uid: 1 })
    expect(One.get(1)).toBeDefined()
    One.evict(1)
    expect(One.get(1)).toBeUndefined()
  })

  it('should print default cache', function () {
    expect(One.print()).toBeDefined()
  })

  it('should reset default cache', function () {
    One.put({ uid: 1 })
    One.put({ uid: 2 })
    One.reset()
    expect(One.get(1)).toBeUndefined()
    expect(One.get(2)).toBeUndefined()
  })

  it('should generate uuid', () => {
    let uuid1 = One.uuid()
    let uuid2 = One.uuid()
    expect(uuid1).toBeDefined()
    expect(typeof uuid1 === 'string').toBe(true)
    expect(uuid1.length > 5).toBe(true)
    expect(uuid2).toBeDefined()
    expect(uuid1 === uuid2).toBe(false)
  })
})
