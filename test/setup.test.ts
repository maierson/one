import 'jest'

import * as One from '../src/cache'
import * as path from '../src/path'

import { cacheSize, deepClone, isArray } from '../src/util'

import CacheMap from '../src/CacheMap'

describe('setup', function () {
  let one
  One.setTesting(false)

  beforeEach(function () {
    One.setTesting(false)
    // reset config before each call
    one = One.getCache()
  })

  afterEach(function () {
    one.reset()
  })

  it('returns singleton instance', function () {
    const cche = One.getCache()
    expect(One.getCache() === cche).toBe(true)
  })

  it('configures with default', () => {
    expect(One.config).toBeDefined()
    expect(One.config.uidName).toBeDefined()
    expect(One.config.maxHistoryStates).toBe(1000)
  })

  it('finds one lib', function () {
    expect(one).toBeDefined()
  })

  it('initializes with no map', function () {
    expect(one).not.toBe(null)
    expect(one.size()).toBe(0)
    expect(one.length()).toBe(0)
  })

  it('initializes second instance', () => {
    let two = One.getCache('two')
    expect(two).toBeDefined()
    expect(One.instances['two']).toBe(two)
    expect(One.instances['one']).toBeDefined()
    expect(one.size()).toBe(0)
    expect(one.length()).toBe(0)
  })

  it('initializes instance', () => {
    // public api
    expect(typeof one.put === 'function').toBe(true)
    expect(typeof one.get === 'function').toBe(true)
    expect(typeof one.getEdit === 'function').toBe(true)
    expect(typeof one.evict === 'function').toBe(true)
    expect(typeof one.reset === 'function').toBe(true)
    expect(typeof one.print === 'function').toBe(true)

    // these guys are private in closure
    expect(one.repo).toBeUndefined()
    expect(one.mainThread).toBeUndefined()
    expect(one.nextNodeKey).toBeUndefined()
  })

  it('does not provide test methods', () => {
    expect(typeof one.refTo === 'function').toBe(false)
    expect(typeof one.refFrom === 'function').toBe(false)
  })
})

