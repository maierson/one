import 'jest'

import * as One from '../src/cache'
import * as path from '../src/path'

import CacheInstance, { ICacheInstance } from '../src/CacheInstance'
import { CacheNode, ICacheNode } from '../src/CacheNode'
import { cacheSize, deepClone, hasUid, isArray, isEmpty } from '../src/util'

import CacheMap from '../src/CacheMap'
import { ICacheStats } from '../src/interfaces'
import { configure } from '../src/config'
import { node } from '../src/locate'

describe('locate', function () {
  let one, callStats

  beforeEach(function () {
    one = One.getCache('one')
    one.put({ uid: 1 })
    one.put({ uid: 2 })
    callStats = one.put({ uid: 3 })
  })

  afterEach(function () {
    one = null
  })

  it('throws if node id not a number', () => {
    let instance: ICacheInstance = new CacheInstance('test')
    expect(() => { node(instance, 'test') }).toThrow('The node id must be a number')
  })

  it('returns false stats on out of range nodeId', () => {
    let instance: ICacheInstance = new CacheInstance('test')
    let result: ICacheStats = node(instance, 10) as ICacheStats
    expect(result.success).toBe(false)
    expect(result.nodeId).toBe(-1)
    expect(result.length).toBe(0)
    expect(result.name).toBe('test')
  })

  it('returns true stats on valid nodeId - middle of binary array ', () => {
    let instance: ICacheInstance = new CacheInstance('test')
    for (let i = 0; i < 3; i++) {
      const nde: ICacheNode = new CacheNode(i)
      instance.addNode(nde)
    }
    let result: ICacheStats = node(instance, 1) as ICacheStats
    expect(result.success).toBe(true)
    expect(result.nodeId).toBe(1)
    expect(result.length).toBe(3)
    expect(result.name).toBe('test')
  })

  it('returns true stats on valid nodeId - left of binary array ', () => {
    let instance: ICacheInstance = new CacheInstance('test')
    for (let i = 0; i < 5; i++) {
      const nde: ICacheNode = new CacheNode(i)
      instance.addNode(nde)
    }
    let result: ICacheStats = node(instance, 1) as ICacheStats
    expect(result.success).toBe(true)
    expect(result.nodeId).toBe(1)
    expect(result.length).toBe(5)
    expect(result.name).toBe('test')
  })
})
