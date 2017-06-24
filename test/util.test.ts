import 'jest'

import * as One from '../src/cache'
import * as path from '../src/path'

import { cacheSize, deepClone, hasUid, isArray, isEmpty } from '../src/util'

import CacheMap from '../src/CacheMap'

describe('Utils', function () {
  let one
  beforeEach(function () {
    let config = {
      uidName: 'uid',
      maxHistoryStates: 1000,
    }
    // reset config before each call
    one = One.getCache('one', config)
  })

  afterEach(function () {
    one = null
  })

  function getTestObj() {
    return {
      a: 'b',
      b: {
        c: [],
        d: ['a', 'b'],
        e: [{}, { f: 'g' }],
        f: 'i',
      },
      c: { uid: 1 },
    }
  }

  it('should not find isArray if missing splice', () => {
    let obj: any = {}
    obj['length'] = 0
    expect(isArray(obj)).toBe(false)
  })

  it('should not find array if length is enumerable', () => {
    let obj: any = {}
    obj['length'] = 0
    obj['splice'] = () => { }
    expect(isArray(obj)).toBe(false)
  })

  it('finds empty obj value', () => {
    let obj = {}
    expect(isEmpty(obj)).toBe(true)
  })

  it('finds empty obj value by key', () => {
    let obj = {}
    obj['test'] = 'test'
    expect(isEmpty(obj)).toBe(false)
  })

  describe('clone', function () {
    it('hasUid should return false on non object', function () {
      expect(hasUid(null)).toBe(false)
    })

    it('should not clone if not object or array', function () {
      expect(deepClone(2)).toBe(2)
    })

    it('should clone date', function () {
      let date: any = new Date()
      let item1 = { uid: 1, date: date }
      let result = deepClone(item1)
      expect(result.date).toBeDefined()
      expect(result.date === date).toBe(false)
      expect(result.date.time === date.time).toBe(true)
      expect(Object.isFrozen(result.date)).toBe(true)
    })

    it('should clone deeply', function () {
      let obj = getTestObj()
      let result = deepClone(obj)
      expect(result).toBeDefined()
      expect(obj === result).toBe(false)
      expect(Object.isFrozen(result)).toBe(true)
    })

    it('should replace item', function () {
      let obj = getTestObj()
      let result = deepClone(obj, { uid: 1, text: 'test' })
      expect(result.c).toBeDefined()
      expect(Object.isFrozen(result.c)).toBe(true)
      expect(result.c.text).toBe('test')
      expect(() => {
        result.c.text = 'new'
      }).toThrow(TypeError)
    })

    it('clones an object deeply', function () {
      let date = new Date()
      let item1 = { uid: 1 }
      let item2 = { uid: 2, date: date }
      let item3 = { uid: 3, arr: [1, 2] }
      let item4 = {
        uid: 4,
        arr: [1, item1, 'string', [item1, item2]],
        item: item3,
      }
      let result = deepClone(item4)
      expect(result === item4).toBe(false)
      expect(result.uid).toBe(4)
      expect(result.arr[0]).toBe(1)
      expect(result.arr[1] === item1).toBe(true)
      expect(result.arr[1].uid).toBe(1)
      expect(result.arr[2]).toBe('string')

      expect(isArray(result.arr[3])).toBe(true)
      expect(result.arr[3][0] === item1).toBe(true)
      expect(result.arr[3][0].uid).toBe(1)

      // item 2 inner clone
      expect(result.arr[3][1] === item2).toBe(true)
      expect(result.arr[3][1].uid).toBe(2)
      // stops at the parent uid item
      expect(result.arr[3][1].date === date).toBe(true)
      expect(result.arr[3][1].date.getTime()).toBe(date.getTime())
    })

    it('returns the object when cloning with replace of itself', function () {
      let item1 = { uid: 1 }
      let result = deepClone(item1, item1, false)
      expect(item1 === result).toBe(true)
    })

    it('should replace item not freeze', function () {
      let obj = getTestObj()
      expect(Object.isFrozen(obj.c)).toBe(false)
      let result = deepClone(obj, { uid: 1, text: 'test' }, false)

      expect(result.c).toBeDefined()
      expect(Object.isFrozen(result.c)).toBe(false)
      expect(result.c.text).toBe('test')
    })

    it('has uid', function () {
      expect(hasUid({ uid: 1 })).toBe(true)
      expect(hasUid({})).toBe(false)
    })
  })

  describe('clear', function () {
    it('clears the cache', function () {
      let item1 = { uid: 1 }
      let item2 = { uid: 2 }
      let item3 = {
        uid: 3,
        item: item1,
      }
      one.put(item3)
      one.put(item2)
      one.reset()
      expect(one.size()).toBe(0)
      expect(one.length()).toBe(0)
    })
  })

  describe('config', function () {
    it('fails to set config if there are items in the cache', function () {
      let a = { uid: 1 }
      one.put(a)
      let config = {
        uidName: 'uuid',
      }
      expect(() => {
        one.config(config)
      }).toThrow(Error)
    })

    it('it does not configure a cleared cache', function () {
      let a = { uid: 1 }
      one.put(a)
      one.reset()
      let conf = {
        uidName: 'uniqueId',
      }
      One.getCache('one', conf)
      expect(One.config.uidName).toBe('uid')
    })

    //it('maintains the correct number of configured history states', function () {
    //    expect(0, 'Not impletmented').toBe(1)
    //})
  })

  describe('print', function () {
    it('prints', function () {
      let item = { uid: 1 }
      let item2 = {
        uid: 2,
        child: item,
      }
      one.put(item2)
      expect(one.get(1)).toBeDefined()
      expect(one.print()).toBeDefined()
    })

    it('prints empty', function () {
      expect(() => {
        one.print()
      }).not.toThrow(Error)
    })
  })
})
