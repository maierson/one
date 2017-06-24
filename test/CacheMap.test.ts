import 'jest'

import * as One from '../src/cache'
import * as path from '../src/path'

import { deepClone, isArray } from '../src/util'

import CacheMap from '../src/CacheMap'
import { configure } from '../src/config'
import { flush } from '../src/flush'

describe('CacheMap', () => {
  let flushMap

  beforeEach(() => {
    flushMap = new CacheMap()
  })

  afterEach(() => {
    flushMap = null
  })

  it('creates flush map', () => {
    expect(flushMap.size()).toBe(0)
  })

  it('sets flush map item', () => {
    flushMap.set('node', {})
    expect(flushMap.size()).toBe(1)
    expect(flushMap.get('node')).toBeDefined()
  })

  it('does not increase length when resetting item', () => {
    flushMap.set('node', {})
    expect(flushMap.size()).toBe(1)
    let item = { test: 'other' }
    flushMap.set('node', item)
    expect(flushMap.size()).toBe(1)
    expect(flushMap.get('node')).toBe(item)
  })

  it('removes item', () => {
    let node1 = { val: 1 }
    let node2 = { val: 2 }
    flushMap.set('node1', node1)
    flushMap.set('node2', node2)
    expect(flushMap.size()).toBe(2)

    let result = flushMap.delete('node1')
    expect(flushMap.size()).toBe(1)
    expect(flushMap.get('node1')).toBeUndefined()
    expect(result).toBe(node1)

    flushMap.delete('node2')
    expect(flushMap.size()).toBe(0)
    expect(flushMap.get('node2')).toBeUndefined()
  })

  it('iterates over map', () => {
    flushMap.set('node1', 'one')
    flushMap.set('node2', 'two')
    flushMap.set('node3', 'three')
    let result = []
    flushMap.forEach((key, value) => {
      result.push(key)
      result.push(value)
    })
    expect(result.length).toBe(6)
    expect(result[0]).toBe('node1')
    expect(result[1]).toBe('one')
    expect(result[2]).toBe('node2')
    expect(result[3]).toBe('two')
    expect(result[4]).toBe('node3')
    expect(result[5]).toBe('three')
  })
})
