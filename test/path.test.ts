/**
 * Created by maierdesign on 12/20/15.
 * Only need get, del from
 * https://github.com/mariocasciaro/object-path
 */
import * as objectPath from '../src/path'

describe('Path', function () {
  function getTestObj() {
    return {
      a: 'b',
      b: {
        c: [],
        d: ['a', 'b'],
        e: [{}, { f: 'g' }],
        f: 'i',
      },
    }
  }

  describe('get', function () {
    it('should return the value under shallow object', function () {
      var obj = getTestObj()
      expect(objectPath.get(obj, 'a')).toBe('b')
      expect(objectPath.get(obj, ['a'])).toBe('b')
    })

    it('should work with number path', function () {
      var obj = getTestObj()
      expect(objectPath.get(obj.b.d, 0)).toBe('a')
      expect(objectPath.get(obj.b, 0)).toBe(void 0)
    })

    it('should return the value under deep object', function () {
      var obj = getTestObj()
      expect(objectPath.get(obj, 'b.f')).toBe('i')
      expect(objectPath.get(obj, ['b', 'f'])).toBe('i')
    })

    it('should return the value under array', function () {
      var obj = getTestObj()
      expect(objectPath.get(obj, 'b.d.0')).toBe('a')
      expect(objectPath.get(obj, ['b', 'd', 0])).toBe('a')
    })

    it('should return the value under array deep', function () {
      var obj = getTestObj()
      expect(objectPath.get(obj, 'b.e.1.f')).toBe('g')
      expect(objectPath.get(obj, ['b', 'e', 1, 'f'])).toBe('g')
    })

    it('should return undefined for missing values under object', function () {
      var obj = getTestObj()
      expect(objectPath.get(obj, 'a.b')).toBeFalsy()
      expect(objectPath.get(obj, ['a', 'b'])).toBeFalsy()
    })

    it('should return undefined for missing values under array', function () {
      var obj = getTestObj()
      expect(objectPath.get(obj, 'b.d.5')).toBeFalsy()
      expect(objectPath.get(obj, ['b', 'd', '5'])).toBeFalsy()
    })

    it('should return the value under integer-like key', function () {
      var obj = { '1a': 'foo' }
      expect(objectPath.get(obj, '1a')).toBe('foo')
      expect(objectPath.get(obj, ['1a'])).toBe('foo')
    })

    it('should return the default value when the key doesnt exist', function () {
      var obj = { '1a': 'foo' }
      expect(objectPath.get(obj, '1b', null)).toBe(null)
      expect(objectPath.get(obj, ['1b'], null)).toBe(null)
    })

    it('should return the default value when path is empty', function () {
      var obj = { '1a': 'foo' }
      expect(objectPath.get(obj, '', null)).toEqual({ '1a': 'foo' })
      expect(objectPath.get(obj, [])).toEqual({ '1a': 'foo' })
      expect(objectPath.get({}, ['1'])).toBe(undefined)
    })

    it('should skip non own properties with isEmpty', function () {
      var Base = function (enabled) {
      }
      Base.prototype = {
        one: {
          two: true,
        },
      }
      var Extended = function () {
        Base.call(this, true)
      }
      Extended.prototype = Object.create(Base.prototype)

      var extended = new Extended()

      expect(objectPath.get(extended, ['one', 'two'])).toBe(undefined)
      extended.enabled = true

      expect(objectPath.get(extended, 'enabled')).toBe(true)
    })
  })

  describe('del', function () {
    it('should return undefined on empty object', function () {
      expect(objectPath.del({}, 'a')).toEqual(void 0)
    })

    it('should work with number path', function () {
      var obj = getTestObj()
      objectPath.del(obj.b.d, 1)
      expect(obj.b.d).toEqual(['a'])
    })

    it('should delete deep paths', function () {
      var obj: any = getTestObj()

      expect(objectPath.del(obj)).toBe(obj)

      obj = {
        a: 'b',
        b: {
          c: [],
          d: ['a', 'b'],
          e: [{}, { f: 'g' }],
          f: 'i',
        },
      }

      let g = [[], ['test', 'test']]
      let h = { az: 'test' }
      obj.b.g = g
      obj.b.h = h

      expect(obj).toHaveProperty('b.g.1.0', 'test')
      expect(obj).toHaveProperty('b.g.1.1', 'test')
      expect(obj).toHaveProperty('b.h.az', 'test')

      objectPath.del(obj, 'b.h.az')
      expect(obj).not.toHaveProperty('b.h.az')
      expect(obj).toHaveProperty('b.h')

      objectPath.del(obj, 'b.g.1.1')
      expect(obj).not.toHaveProperty('b.g.1.1')
      expect(obj).toHaveProperty('b.g.1.0', 'test')

      objectPath.del(obj, ['b', 'g', '1', '0'])
      expect(obj).not.toHaveProperty('b.g.1.0')
      expect(obj).toHaveProperty('b.g.1')

      expect(objectPath.del(obj, ['b'])).not.toHaveProperty('b.g')
      expect(obj).toEqual({ 'a': 'b' })
    })

    it('should remove items from existing array', function () {
      var obj = getTestObj()

      objectPath.del(obj, 'b.d.0')
      expect(obj.b.d).toHaveLength(1)
      expect(obj.b.d).toEqual(['b'])

      objectPath.del(obj, 'b.d.0')
      expect(obj.b.d).toHaveLength(0)
      expect(obj.b.d).toEqual([])
    })

    it('should skip undefined paths', function () {
      var obj = getTestObj()

      expect(objectPath.del(obj, 'do.not.exist')).toBe(obj)
      expect(objectPath.del(obj, 'a.c')).toBe('b')
    })
  })
})
