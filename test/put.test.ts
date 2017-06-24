import 'jest'

import * as One from '../src/cache'
import * as path from '../src/path'

import { deepClone, hasUid, isArray } from '../src/util'

import CacheItem from '../src/CacheItem'
import CacheMap from '../src/CacheMap'
import { configure } from '../src/config'

describe('put-get', function () {
  let one
  One.setTesting(true)

  beforeEach(function () {
    One.setTesting(true)
    // reset config before each call
    one = One.getCache()
  })

  afterEach(function () {
    one.reset()
  })

  it('should put simple uid entity', () => {
    const item = { uid: 1 }
    one.put(item)
    expect(Object.isFrozen(item)).toBe(true)

    const result = one.get(1)
    expect(result).toBeDefined()
    expect(result.uid === item.uid).toBe(true)
    expect(result === item).toBe(true)
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('should put frozen object', function () {
    const item1 = { uid: 1 }
    const item2 = { uid: '2', item: item1, otherItem: undefined }
    one.put(item2)

    expect(one.size()).toBe(2)
    expect(one.length()).toBe(1)

    const result2 = one.get(2)
    expect(result2.uid).toBe('2')
    expect(result2.item.uid).toBe(1)

    expect(Object.isFrozen(result2)).toBe(true)

    // also can retrieve 1 separately
    const result1 = one.get(1)
    expect(result1).toBeDefined()
    expect(result1.uid).toBe(1)
    expect(Object.isFrozen(result1)).toBe(true)
  })

  it('should put simple array', function () {
    const item1 = { uid: 1 }
    const item2 = { uid: 2 }
    one.put([item1, item2])
    const result = one.get(1)
    expect(result).toBeDefined()
    expect(Object.isFrozen(result)).toBe(true)
    const result2 = one.get(2)
    expect(result2).toBeDefined()
    expect(Object.isFrozen(result2)).toBe(true)
    expect(one.size()).toBe(2)
    expect(one.length()).toBe(1)
  })

  it('should put item with simple array', function () {
    const item = { uid: 1, items: ['one', 'two', 'three'] }
    one.put(item)
    const result = one.get(1)
    expect(result).toBeDefined()
    expect(result.items.length).toBe(3)
    expect(result.items[0]).toBe('one')
    expect(result.items[1]).toBe('two')
    expect(result.items[2]).toBe('three')
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.items)).toBe(true)
  })

  it('should put item with array of arrays', () => {
    const item = {
      uid: 'top',
      items: [
        [{ uid: 1 }, { uid: 2 }],
        [{ uid: 3 }]],
    }
    one.put(item)

    expect(one.refFrom(1).get('top')[0]).toBe('items.0.0')
    expect(one.refFrom(1).size()).toBe(1)
    expect(one.refTo(1).size()).toBe(0)

    expect(one.refFrom(2).get('top')[0]).toBe('items.0.1')
    expect(one.refFrom(2).size()).toBe(1)
    expect(one.refTo(2).size()).toBe(0)

    expect(one.refFrom(3).get('top')[0]).toBe('items.1.0')
    expect(one.refFrom(3).size()).toBe(1)
    expect(one.refTo(3).size()).toBe(0)
  })

  it('should put item with array of arrays repeating', () => {
    const item = { uid: 'top', items: [[{ uid: 1 }, { uid: 2 }], [{ uid: 1 }]] }
    one.put(item)

    expect(one.refFrom(1).get('top')[0]).toBe('items.0.0')
    expect(one.refFrom(1).get('top')[1]).toBe('items.1.0')
    expect(one.refFrom(1).size()).toBe(1)
    expect(one.refTo(1).size()).toBe(0)

    expect(one.refFrom(2).get('top')[0]).toBe('items.0.1')
    expect(one.refFrom(2).size()).toBe(1)
    expect(one.refTo(2).size()).toBe(0)
  })

  it('should freeze entity deeply', function () {
    const item1 = { uid: 1 }
    const item2 = { uid: 2, item: item1 }
    const item3 = {
      uid: 3,
      item: item2,
    }
    one.put(item3)
    const result = one.get(3)
    expect(item3 === result).toBe(true)
    //fail
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.item)).toBe(true)
    expect(Object.isFrozen(result.item.item)).toBe(true)
    expect(Object.isFrozen(item3)).toBe(true)
  })

  it('should put / get even if top entity has no uid', function () {
    const item1 = { uid: 1 }
    const item = {
      val: 'test',
      item: item1,
    }
    one.put(item)
    const result = one.get(1)
    expect(result).toBeDefined()
    expect(() => {
      result.test = 'something'
    }).toThrow(TypeError)
  })

  it('should not put the entity if not changed', function () {
    const item1 = { uid: 1 }
    const state = one.put(item1)
    expect(state.success).toBe(true)
    state = one.put(item1)
    expect(state.success).toBe(false)
  })

  it('should not put array from top entity that has no uid', function () {
    const item1 = { uid: 1 }
    const item2 = { uid: 2, items: [item1] }
    const item = {
      val: 'test',
      items: [item2],
    }
    one.put(item)
    expect(one.get(1)).toBeDefined()
    expect(one.get(2)).toBeDefined()
    expect(one.size()).toBe(2)
    expect(one.length()).toBe(1)
  })

  it('should get editable clone', () => {
    const item = { uid: 1 }
    one.put(item)
    const result = one.getEdit(1)
    expect(result).toBeDefined()
    expect(Object.isFrozen(result)).toBe(false)
    expect(item === result).toBe(false)
  })

  it('should maintain direct references non editable', () => {
    const item = { uid: 1 }
    const item2 = { uid: 2, item: item }
    one.put(item2)
    const result = one.getEdit(2)
    expect(result.item).toBeDefined()
    expect(result.item === item).toBe(true)
    expect(Object.isFrozen(result.item)).toBe(true)
    expect(result === item2).toBe(false)
    expect(result.uid === item2.uid).toBe(true)
  })

  it('should maintain array references non editable', () => {
    const item = { uid: 1 }
    const item2 = { uid: 2, items: [item] }
    one.put(item2)
    const result = one.getEdit(2)
    expect(result.items).toBeDefined()
    expect(result.items[0] === item).toBe(true)
    expect(Object.isFrozen(result.items)).toBe(false)
    expect(Object.isFrozen(result.items[0])).toBe(true)
    expect(result === item2).toBe(false)
    expect(result.uid === item2.uid).toBe(true)
  })

  it('should put simple array on strong', function () {
    const item = { uid: 1, items: ['one', 'two', 'three'] }
    one.put(item)
    const result = one.getEdit(1)
    result.items.push('four')
    result.items.push('five')
    one.put(result, true)
    expect(one.get(1).items.length).toBe(5)
    expect(result.items[0]).toBe('one')
    expect(result.items[1]).toBe('two')
    expect(result.items[2]).toBe('three')
    expect(one.get(1).items[3]).toBe('four')
    expect(one.get(1).items[4]).toBe('five')
  })

  it('should update parent when inner uid ref changed'
    + ' but keeps other children references unchanged', function () {
      const item1 = { uid: 1 }
      const item2 = { uid: 2 }
      const item3 = {
        uid: 3,
        item1: item1,
        item2: item2,
      }
      one.put(item3)

      const item4 = { uid: 4 }
      one.put(item4)
      const edit1 = one.getEdit(1)
      edit1.item = item4
      one.put(edit1)

      const result = one.get(3)
      expect(item2 === result.item2).toBe(true)
      const result2 = one.get(2)
      expect(item2 === result2).toBe(true)
    })

  it('should update parent when inner uid ref changed ' +
    'but keeps other children references unchanged in ARRAY', function () {
      const item = { uid: 'item' }
      const item1 = { uid: 1 }
      const item2 = { uid: 2 }
      const item3 = {
        uid: 3,
        item: item,
        children: [item1, item2],
      }
      one.put(item3)

      const item4 = { uid: 4 }
      one.put(item4)
      const edit1 = one.getEdit(1)
      edit1.item = item4
      one.put(edit1)

      const itemResult = one.get('item')
      expect(item === itemResult).toBe(true)
      const result = one.get(3)
      expect(item2 === result.children[1]).toBe(true)
      const result2 = one.get(2)
      expect(item2 === result2).toBe(true)
    })

  it('should put top item with array but no uid', () => {
    const item1 = { uid: 1 }
    const item2 = { uid: 2 }
    const item = {
      value: 'test',
      items: [
        item1, item2,
      ],
    }
    one.put(item)
    const result1 = one.get(1)
    expect(result1).toBeDefined()

    const result2 = one.get(2)
    expect(result2).toBeDefined()
  })

  it('should put top array even if it contains no uid items', function () {
    const firstItem = { uid: 'first' }
    const item1 = { uid: 1, item: firstItem }
    const item2 = { uid: 2 }
    const item3 = { uid: 3 }
    const item4 = {
      uid: 4,
      value: 'four',
      items: [item3],
    }
    const item = {
      value: 'test',
      items: [item1, item2],
    }
    const arr = [item1, item2, item4, item]
    one.put(arr)
    expect(one.get(1)).toBeDefined()
    expect(one.get(firstItem)).toBeDefined()
    expect(one.get(2)).toBeDefined()
    expect(one.get(4)).toBeDefined()
    expect(one.get(3)).toBeDefined()
    expect(one.length()).toBe(1)
    expect(one.size()).toBe(5)
  })

  it('should put array of items', function () {
    const item1 = { uid: 1 }
    const item2 = { uid: 2 }
    const item3 = { uid: 3, item: item2 }
    one.put([item1, item3])
    expect(one.size()).toBe(3)
    expect(one.length()).toBe(1)
    expect(one.get(1)).toBeDefined()
    expect(one.get(2)).toBeDefined()
    expect(one.get(3)).toBeDefined()
  })

  it('should replace existing props on existing entity '
    + 'when putting new entity that does not have them', function () {
      const item = {
        uid: 1,
        test: 'test',
        children: ['one', 'two'],
      }
      one.put(item)
      const item2 = {
        uid: 1,
        some: 'some',
        children: ['three', 'one'],
      }
      one.put(item2)

      const result = one.get(1)

      expect(result.test).toBeUndefined()
      expect(result.some).toBe('some')

      const hasOne = result.children.some(itm => itm === 'one')
      expect(hasOne).toBe(true)

      const hasThree = result.children.some(itm => itm === 'three')
      expect(hasThree).toBe(true)
    })

  it('should put array of entities in one cache update', function () {
    const arr = [{ uid: 1 }, { uid: 2 }, { uid: 3 }]
    one.put(arr)
    expect(one.length()).toBe(1)
    expect(one.size()).toBe(3)
    expect(one.get(1)).toBeDefined()
    expect(one.get(2)).toBeDefined()
    expect(one.get(3)).toBeDefined()
  })

  it('should put a complex tree of objects contained in an array', function () {
    const item1 = { uid: 1 }
    const item2 = { uid: 2, item: item1 }
    const item3 = {
      uid: 3,
      item: item2,
      children: [item1],
    }
    const arr = [item1, item2, item3]
    one.put(arr)
    expect(one.length()).toBe(1)
    expect(one.size()).toBe(3)
    expect(one.get(1)).toBeDefined()
    const res2 = one.get(2)
    expect(res2).toBeDefined()
    expect(res2.item.uid).toBe(1)
    const res3 = one.get(3)
    expect(res3).toBeDefined()
    expect(res3.children[0].uid).toBe(1)
  })

  it('should not add to cache if no uid', function () {
    const existing = { uid: '' }
    one.put(existing)
    expect(one.size()).toBe(0)
    expect(one.length()).toBe(0)
  })

  it('should add new item to the cache', function () {
    const item = { uid: 1, value: 'one' }
    one.put(item)
    expect(one.size()).toBe(1)
    expect(one.length()).toBe(1)
  })

  it('should add inner array objects to the cache', function () {
    const item = {
      uid: 1,
      relative: { uid: 4, value: 'four' },
      children: [
        { uid: 2, value: 'two' },
        { uid: 3, value: 'three' },
      ],
    }
    one.put(item)

    // all items with uid are added to the cache
    expect(one.size()).toBe(4)
    expect(one.get(1)).toBeDefined()

    const item2 = one.get(2)
    expect(item2).toBeDefined()
    expect(item2.value).toBe('two')

    const item3 = one.get(3)
    expect(item3).toBeDefined()
    expect(item3.value).toBe('three')

    const item4 = one.get(4)
    expect(item4).toBeDefined()
    expect(item4.value).toBe('four')

    // only one extra cache state is added
    expect(one.length()).toBe(1)
    // with undo we are at the beginning of the nodes array
    const historyState = one.put({ uid: 100 })
  })

  it('should update all pointing parents when putting nested entity', function () {
    const item1: any = { uid: 1 }
    // const item2 = { uid: 2 }
    const item3 = {
      uid: 3,
      //   item: item2,
      otherItem: {
        nested: item1,
      },
    }
    one.put(item3)
    expect(one.length()).toBe(1)
    expect(one.size()).toBe(2)

    // at this point item1 is frozen. To continue editing must get a copy
    const item1Res = one.getEdit(1)
    // change item 1 and make sure it modified in item2 on current state but not previous
    item1Res.text = 'text'
    one.put(item1Res)
    const result = one.get(3)
    expect(result.otherItem.nested.text).toBe('text')
    // one.undo()
    // result = one.get(3)
    // expect(result.otherItem.nested.text).toBeUndefined()
  })

  it('should update all pointing parents when putting and entity updated deeply inside another', function () {
    const item1 = { uid: 1, val: 'one' }
    const item2 = {
      uid: 2,
      item: item1,
    }
    one.put(item2)
    const otherItem1 = {
      uid: 1,
      val: 'two',
    }
    const item3 = {
      uid: 3,
      other: otherItem1,
    }
    one.put(item3)
    const result = one.get(2)
    expect(result.item.val).toBe('two')
  })

  it('should update all pointing parents when putting and entity updated deeply inside another"s array', function () {
    const item1 = { uid: 1, val: 'one' }
    const item2 = {
      uid: 2,
      item: item1,
    }
    one.put(item2)
    const otherItem1 = {
      uid: 1,
      val: 'two',
    }
    const item3 = {
      uid: 3,
      others: [otherItem1],
    }
    one.put(item3)
    const result = one.get(2)
    expect(result.item.val).toBe('two')
  })

  it('should add deep inner nested objects to the cache', function () {
    const item1: any = { uid: 1 }
    const item2 = {
      uid: 2,
      item: {
        nested: {
          deep: item1,
        },
      },
    }
    one.put(item2)
    expect(one.length()).toBe(1)
    expect(one.size()).toBe(2)

    // change item 1 and make sure it modified in item2 on current state but not previous
    const item1Res = one.getEdit(item1)
    item1Res.text = 'text'
    one.put(item1Res)
    const result = one.get(2)
    expect(result.item.nested.deep.text).toBe('text')
    // one.undo()
    // result = one.get(2)
    // expect(result.item.nested.deep.text).toBeUndefined()
  })

  it('should add inner nested objects in array to the cache', function () {
    const item1: any = { uid: 1 }
    const item2 = {
      uid: 2,
      item: {
        nested: [item1],
      },
    }
    one.put(item2)
    expect(one.length()).toBe(1)
    expect(one.size()).toBe(2)

    // change item 1 and make sure it modified in item2 on current state but not previous
    const item1Res = one.getEdit(item1)
    item1Res.text = 'text'

    one.put(item1Res)

    const result = one.get(2)
    expect(result.item.nested[0].text).toBe('text')
  })

  it('should cache various nested scenarios', function () {
    const item = {
      uid: 1,
      relative: { uid: 4, value: 'four' },
      children: [
        {
          uid: 2,
          value: 'two',
          children: [
            { uid: 5, value: 'five' },
            { uid: 6, value: 'six' },
          ],
        },
        {
          uid: 3,
          value: 'three',
        },
      ],
    }
    one.put(item)

    // check state
    expect(one.size()).toBe(6)
    expect(one.length()).toBe(1)

    // check items
    const result1 = one.get(1)
    expect(result1.children.length).toBe(2)
    expect(result1.children[0].uid).toBe(2)
    expect(result1.children[1].uid).toBe(3)
    const result2 = one.get(2)
    expect(result2.children.length).toBe(2)
    expect(result2.children[0].uid).toBe(5)
    expect(result2.children[1].uid).toBe(6)
  })

  it('keeps non uid references as is', function () {
    const item1 = { uid: 1, value: 'one' }
    const item3 = { uid: 3, value: 'three' }
    const item2 = {
      uid: 2,
      ref: item1,
      value: { val: 'one' },
      value2: 'two',
      children: [
        item3,
        { value: 'test' },
      ],
    }
    one.put(item2)
    const result = one.get(2)
    expect(result.value.val).toBe('one')
    expect(result.value2).toBe('two')
    expect(result.children[1].value).toBe('test')
  })

  it('adds deeply nested array objects to the cache', function () {
    const item = {
      uid: 1,
      children: [
        [
          { uid: 2, value: 'two' },
          {
            uid: 3,
            children: [{ uid: 4, value: 'four' }],
          },
        ],
      ],
    }
    one.put(item)

    expect(one.size()).toBe(4)

    const item1 = one.get(1)
    expect(item1).toBeDefined()
    expect(isArray(item1.children)).toBe(true)
    expect(item1.children.length).toBe(1)

    const child1 = item1.children[0]
    expect(isArray(child1)).toBe(true)
    expect(child1.length).toBe(2)

    const item2 = one.get(2)
    expect(item2).toBeDefined()
    expect(item2.value).toBe('two')

    const item3 = one.get(3)
    expect(item3).toBeDefined()
    expect(isArray(item3.children)).toBe(true)
    expect(item3.children.length).toBe(1)

    const item4 = one.get(4)
    expect(item4).toBeDefined()
    expect(item4.value).toBe('four')

    expect(one.length()).toBe(1)
  })

  it('does not alter the original when putting new', function () {
    const item2 = { uid: 2 }
    const item3 = { uid: 3 }
    const item4 = { uid: 4 }

    const original = {
      uid: 1,
      ref: item2,
      children: [item3, item4],
    }
    one.put(original)

    expect(original.ref).toBe(item2)
    expect(original.children[0]).toBe(item3)
    expect(original.children[1]).toBe(item4)
  })

  it('updates array when changed', function () {
    const item2 = { uid: 2 }
    const item3 = { uid: 3 }
    const item4 = { uid: 4 }
    const item = {
      uid: 1,
      ref: item2,
      children: [item3],
    }
    one.put(item)

    const editableItem = one.getEdit(1)
    editableItem.children.pop()
    editableItem.children.push(item4)

    one.put(editableItem)

    const result = one.get(1)
    expect(result.children[0].uid).toBe(4)
  })

  it('does not put if there are no changes to the item', function () {
    const item2 = { uid: 2 }
    const item3 = { uid: 3 }
    const item4 = { uid: 4 }
    const item = {
      uid: 1,
      ref: item2,
      children: [item3, item4],
    }
    one.put(item)
    expect(one.length()).toBe(1)
    expect(Object.isFrozen(item)).toBe(true)
    expect(item === one.get(1)).toBe(true)
    one.put(item)
    expect(one.length()).toBe(1)
  })

  it('should add reference to new object when exisiting on the cache', () => {
    const item1 = { uid: 1 }
    one.put(item1)
    const item2 = {
      uid: 2,
      item: item1,
    }
    one.put(item2)
    one.evict(item1)
    expect(one.get(1)).toBeUndefined()
  })

  it('maintains single reference to object '
    + 'retrieved in multiple places in deep structure', function () {

      const item1 = { uid: 1, value: 'one' }
      const item2 = {
        uid: 2,
        child: item1,
        children: [
          item1,
          { value: 'test' },
        ],
      }

      one.put(item2)

      const otherItem1 = {
        uid: 1,
        value: 'two',
      }

      const item3 = {
        uid: 3,
        // item: item1, // cannot do this - it introduces 2 different instances with same uid in one shot
        otherItem: otherItem1,
      }
      one.put(item3)

      const result2 = one.get(2)
      expect(result2.child.uid).toBe(1)
      expect(result2.children[0].uid).toBe(1)
      expect(result2.child === result2.children[0]).toBe(true)

      // but the value was updated globally
      expect(result2.child.value).toBe('two')

      const result3 = one.get(3)
      expect(result2.child === result3.otherItem).toBe(true)
    })

  it('rejects putting 2 instances in one put with same uid')

  it('preserves properties with null values', function () {
    const item1 = { uid: 1, value: 'one' }
    const item2 = {
      uid: 2,
      child: null,
      children: [
        item1,
        { value: 'test' },
      ],
    }
    one.put(item2)
    const result = one.get(2)
    expect(result.child).toBe(null)
  })

  it('does not put primitive', function () {
    expect(one.put(1).success).toBe(false)
  })

  it('returns proper boolean when putting item', function () {
    const item2 = { uid: 2 }
    const item3 = { uid: 3 }
    const item4 = { uid: 4 }
    const item = {
      uid: 1,
      value: 'test',
      ref: item2,
      children: [item3, item4],
    }
    expect(one.put(item).success).toBe(true)
    expect(one.put(item).success).toBe(false)
  })

  it('creates new entity when updating through a referenced entity', function () {
    const item1 = { uid: 1 }
    one.put(item1)
    const item2 = { uid: 2, item: { uid: 1, test: 'test' } }
    one.put(item2)
    const result = one.get(1)
    expect(result.test).toBe('test')
    // one.undo()
    // result = one.get(1)
    // expect(result.test).toBeUndefined()
  })

  it('builds prop chain for nested objects', () => {
    const item1 = { uid: 1 }
    const item2 = {
      uid: 2,
      level0: {
        level1: {
          level2: item1,
        },
      },
    }
    one.put(item2)
    expect(one.refTo(2).size()).toBe(1)
    expect(one.refTo(2).paths['1'][0]).toBe('level0.level1.level2')
  })

  it('builds the prop chain correctly for objects', function () {
    const item = { uid: 1 }
    const item2 = {
      uid: 2,
      rootItem: item,
      ref: {
        inner: {
          item,
        },
      },
    }

    one.put(item2)

    const refFrom = one.refFrom(1).paths
    expect(refFrom['2']).toBeDefined()
    expect(isArray(refFrom['2'])).toBe(true)
    expect(refFrom['2'][0]).toBe('rootItem')
    expect(refFrom['2'][1]).toBe('ref.inner.item')

    const refTo = one.refTo(2).paths
    expect(refTo['1']).toBeDefined()
    expect(isArray(refTo['1'])).toBe(true)
    expect(refTo['1'][0]).toBe('rootItem')
    expect(refTo['1'][1]).toBe('ref.inner.item')
  })

  it('doesn"t reference entity inside another entity', function () {
    const item1 = { uid: 1 }
    const item2 = { uid: 2, item: item1 }
    const item3 = {
      uid: 3,
      item: item2,
    }
    one.put(item3)

    const refTo = one.refTo(3)
    expect(refTo['1']).toBeUndefined()
  })

  it('builds the prop chain correctly for array', function () {
    const item = { uid: 1 }
    const item2 = {
      uid: 2,
      items: [item],
    }
    one.put(item2)
    expect(one.refTo(2).paths['1'][0]).toBe('items.0')
    expect(one.refFrom(1).paths['2'][0]).toBe('items.0')
  })

  it('builds the prop chain for inner nested array items', function () {
    const item1 = { uid: 1 }
    const item3 = { uid: 3, item: item1 }
    const item2 = { uid: 2, items: [item1, item3] }
    one.put([item2, item3])

    const items = one.get(2).items
    expect(items.length).toBe(2)

    expect(one.refTo(1).size()).toBe(0)
    expect(one.refFrom(1).paths[2][0]).toBe('items.0')
    expect(one.refFrom(1).paths[3][0]).toBe('item')

    expect(one.refTo(2).paths[1][0]).toBe('items.0')
    expect(one.refTo(2).paths[3][0]).toBe('items.1')
    expect(one.refTo(2).size()).toBe(2)

    expect(one.refFrom(3).paths['2'][0]).toBe('items.1')
    expect(one.refFrom(3).size()).toBe(1)
  })

  it('builds the prop chain correctly for nested array', function () {
    const item = { uid: 1 }
    const item2 = {
      uid: 2,
      items: [item, [item]],
    }
    //TODO maybe keep track of number of refs inside an array to know how deep to search (might be overkill and
    // better to just iterate the array to the end when removing references
    one.put(item2)
    expect(one.refTo(2).paths['1'][0]).toBe('items.0')
    expect(one.refTo(2).size()).toBe(1)
    expect(one.refFrom(1).paths['2'][0]).toBe('items.0')
    expect(one.refFrom(1).size()).toBe(1)
  })

  it('replaces existing entities if putting dirty', function () {
    const item1 = { uid: 1 }
    one.put(item1)
    const item1a = { uid: 1 }
    const item2 = { uid: 2, item: item1a }

    // putting weak should not replace item1 in the cache
    one.put(item2, false)
    const result = one.get(1)
    expect(result === item1a).toBe(true)
    expect(result === item1).toBe(false)
  })

  it('should replace existing entities when putting dirty new version inside array', function () {
    const item1 = { uid: 1 }
    const item2 = { uid: 2, item: item1 }
    one.put(item2)
    const item1a = { uid: 1 }
    // put it weakly
    one.put([item1a])
    const result = one.get(1)
    expect(result === item1).toBe(false)
    expect(result === item1a).toBe(true)
  })

  it('replaces direct existing entity on dirty put', function () {
    const item1 = { uid: 1 }
    const item1a = { uid: 1, val: 'value' }
    one.put(item1)
    one.put(item1a)
    const result = one.get(1)
    expect(result.val).toBe('value')
  })

  it('removes items from entity when putting over cached version', () => {
    const item = { uid: 1 }
    const item2 = { uid: 2, item: item }

    one.put(item2)
    const editable = one.getEdit(2)
    editable.item = undefined
    one.put(editable)
    expect(one.get(1)).toBeUndefined()
  })

  it('removes items from entity array when putting over cached version', () => {
    const item = { uid: 1 }
    const item3 = { uid: 3 }
    const item2 = { uid: 2, items: [item3, item] }

    one.put([item2, item3])
    const editable = one.getEdit(2)
    editable.items = [item3]
    one.put(editable)
    expect(one.get(1)).toBeUndefined()
  })

  it('puts first come first served', () => {
    const item1 = { uid: 1, val: 'item1' }
    const item2 = { uid: 1, val: 'item2' }
    one.put([item1, item2])
    expect(one.size()).toBe(1)
    expect(one.length()).toBe(1)
    expect(one.get(1).val).toBe('item1')
  })

  it('puts first come first served nested', () => {
    const item1 = { uid: 1, val: 'item1' }
    const item2 = { uid: 1, val: 'item2' }
    const item3: any = {
      uid: 3,
      otherItem: item2,
      item: item1,
    }
    one.put(item3)
    expect(one.size()).toBe(2)
    expect(one.length()).toBe(1)
    expect(one.get(1).val).toBe('item2')
  })

  it('puts first come first served in array', () => {
    const item1 = { uid: 1, val: 'item1' }
    const item2 = { uid: 1, val: 'item2' }
    const item3: any = {
      uid: 3,
      otherItem: [item2],
      item: item1,
    }
    one.put(item3)
    expect(one.size()).toBe(2)
    expect(one.length()).toBe(1)
    expect(one.get(1).val).toBe('item2')
  })

  it('builds multiple nested arrays correctly', () => {
    const item1 = { uid: 1 }
    const item2 = { uid: 2 }
    const item3 = { uid: 3 }
    const item4 = { uid: 4 }
    const item5 = { uid: 5 }
    const main = { uid: 'main', first: [item1, item2, item5], second: [item3, item4, item5] }
    one.put(main)
    expect(one.refTo('main').size()).toBe(5)
    expect(one.refTo('main').paths[1][0]).toBe('first.0')
    expect(one.refTo('main').paths[2][0]).toBe('first.1')
    expect(one.refTo('main').paths[3][0]).toBe('second.0')
    expect(one.refTo('main').paths[4][0]).toBe('second.1')
    expect(one.refTo('main').paths[5][0]).toBe('first.2')
    expect(one.refTo('main').paths[5][1]).toBe('second.2')
  })

  it('should put parallel objects ', () => {

    const main = {
      uid: 2,
      item1: {
        item2: {
          item3: {
            uid: 3,
          },
          item4: {
            uid: 4,
          },
        },
      },
    }
    one.put(main)
    expect(one.get(3)).toBeDefined()
    expect(one.get(4)).toBeDefined()
  })

  it('should not get blocked by no uid object', () => {
    const subItem = { uid: 1 }
    const main = {
      uid: 2,
      item1: {
        item2: {
          item3: {
            uid: 3,
          },
          item4: {
            uid: 4,
            item7: {
              uid: 7,
            },
          },
          item5: {
            item6: {
              test: true,
              subItem,
            },
          },
        },
      },
      // items2: [subItem]
    }
    one.put(main)
    expect(one.get(1)).toBeDefined()
  })

  it('should not get blocked by empty array', () => {
    const subItem = { uid: 1 }
    const main = {
      uid: 2,
      items1: [],
      //  items3: [],
      items2: [subItem],
    }
    one.put(main)
    expect(one.get(1)).toBeDefined()
  })
})
