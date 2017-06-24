import 'jest'

import * as One from '../src/cache'
import * as path from '../src/path'

import { deepClone, isArray } from '../src/util'

import CacheMap from '../src/CacheMap'
import { configure } from '../src/config'

describe('get', function () {
  let one

  beforeEach(function () {
    // reset config before each call
    one = One.getCache()
  })

  afterEach(function () {
    one.reset()
  })

  it('gets array of items in requested order', function () {
    let item1 = { uid: 1 }
    let item2 = { uid: 2 }
    let item3 = { uid: 3, item: item2 }
    one.put([item1, item3])
    let result = one.get([1, 3, item2])
    expect(isArray(result)).toBe(true)
    expect(result[0].uid).toBe(1)
    expect(result[1].uid).toBe(3)
    expect(result[2].uid).toBe(2)
    // aslo check identity
    expect(item2 === result[1].item).toBe(true)
  })

  it('gets undefined for non existing cached item', function () {
    expect(one.get(1)).toBeUndefined()
    expect(one.getEdit(1)).toBeUndefined()
    expect(one.get({ uid: 1 })).toBeUndefined()
  })

  it('gets editable entity that is a clone of the cached entity', function () {
    let item1 = { uid: 1 }
    one.put(item1)
    let result = one.get(1)
    let resultEdit = one.getEdit(1)
    expect(resultEdit).toBeDefined()
    expect(result === resultEdit).toBe(false)
    expect(result.uid).toBe(1)
    resultEdit.test = 'something'
    expect(resultEdit.test).toBe('something')
    expect(result.test).toBeUndefined()
  })

  it('gets editable array of clones', function () {
    let item1 = { uid: 1 }
    let item2 = { uid: 2 }
    let item3 = { uid: 3, item: item2 }
    one.put([item1, item3])
    let result = one.getEdit([1, 3, item2])

    expect(isArray(result)).toBe(true)
    expect(result[0].uid).toBe(1)
    expect(result[1].uid).toBe(3)
    expect(result[2].uid).toBe(2)
    // aslo check identity
    expect(item2 === result[1].item).toBe(true)
    expect(result[2] === result[1].item).toBe(false)
  })

  it('maintains deep objects without uid editable when getting editable', function () {
    let firstObj = { text: 'test' }
    let secondObj = { text: 'new' }
    let item2 = { uid: 2 }
    let item3 = { uid: 3 }
    let item = {
      uid: 1,
      item: firstObj,
      item3: item3,
      children: [
        'something',
        secondObj,
        item2,
      ],
    }
    one.put(item)

    // check object reference to be frozen and identical to original
    let result = one.get(1)
    expect(Object.isFrozen(result.item)).toBe(true)
    expect(firstObj === result.item).toBe(true)

    expect(Object.isFrozen(result.children)).toBe(true)
    expect(result.children[1] === secondObj).toBe(true)
    expect(result === item).toBe(true)
    expect(Object.isFrozen(result.item3)).toBe(true)
    expect(result.item3 === item3).toBe(true)
    expect(Object.isFrozen(result.children[2])).toBe(true)
    expect(result.children[2] === item2).toBe(true)

    // check object reference to be frozen and identical to original after editable
    let editableResult = one.getEdit(1)
    // non uid items come out editable
    expect(Object.isFrozen(editableResult.item)).toBe(false)
    // non uid items are replaced and made editable
    expect(firstObj === editableResult.item).toBe(false)
    // arrays are made editable
    expect(Object.isFrozen(editableResult.children)).toBe(false)
    // their non uid items are replaced and made editable
    expect(editableResult.children[1] === secondObj).toBe(false)
    // maintain uid reference as is
    expect(Object.isFrozen(result.item3)).toBe(true)
    expect(result.item3 === item3).toBe(true)
    // maintain all uid items (even nested in array) as is
    expect(Object.isFrozen(result.children[2])).toBe(true)
    expect(result.children[2] === item2).toBe(true)
    // new editable parent
    expect(editableResult === item).toBe(false)
  })

  it('maintins deep objects with uid identical when getting editable', function () {
    let item1 = { uid: 1 }
    let item2 = { uid: 2, item: item1 }
    one.put(item2)
    let result = one.get(2)
    expect(result.item === item1).toBe(true)

    result = one.getEdit(2)
    expect(result.item === item1).toBe(true)
    expect(Object.isFrozen(result.item)).toBe(true)
  })

  it('maintains deep objects whithin array identical when getting editable', function () {
    let item1 = { uid: 1 }
    let item2 = { uid: 2 }
    let item3 = {
      uid: 3,
      items: [item1, item2],
    }
    one.put(item3)
    let result = one.getEdit(3)
    expect(result.items[0] === item1).toBe(true)
    expect(Object.isFrozen(result.items[0])).toBe(true)
    expect(result.items[1] === item2).toBe(true)
    expect(Object.isFrozen(result.items[1])).toBe(true)
  })

  it('throws error if getting without an item or uid', function () {
    expect(() => {
      one.get()
    }).toThrow(TypeError)
  })

  it('gets an entire array by uid', function () {
    let item1 = { uid: 1 }
    let item2 = { uid: 2 }
    let item3 = { uid: 3 }
    let item4 = {
      uid: 4,
      items: [item1, item2],
    }
    one.put([item1, item2, item3, item4])
    let result = one.get([1, 2, 4])
    expect(isArray(result)).toBe(true)
    expect(result.length).toBe(3)
    expect(result[0].uid).toBe(1)
    expect(result[1].uid).toBe(2)
    expect(result[2].uid).toBe(4)
    expect(result[2].items[0].uid).toBe(1)
    expect(result[2].items[1].uid).toBe(2)
  })

  it('gets an entire array by entities', function () {
    let item1 = { uid: 1 }
    let item2 = { uid: 2 }
    let item3 = { uid: 3 }
    let item4 = { uid: 4, items: [item1, item2] }
    one.put([item1, item2, item3, item4])
    let result = one.get([item1, item2, item4])
    expect(isArray(result)).toBe(true)
    expect(result.length).toBe(3)
    expect(result[0].uid).toBe(1)
    expect(result[1].uid).toBe(2)
    expect(result[2].uid).toBe(4)
    expect(result[2].items[0].uid).toBe(1)
    expect(result[2].items[1].uid).toBe(2)
  })

  it('gets an array mixed by entity or uid', function () {
    let item1 = { uid: 1 }
    let item2 = { uid: 2 }
    let item3 = { uid: 3 }
    let item4 = { uid: 4, items: [item1, item2] }
    one.put([item1, item2, item3, item4])
    let result = one.get([1, item2, 4])
    expect(isArray(result)).toBe(true)
    expect(result.length).toBe(3)
    expect(result[0].uid).toBe(1)
    expect(result[1].uid).toBe(2)
    expect(result[2].uid).toBe(4)
    expect(result[2].items[0].uid).toBe(1)
    expect(result[2].items[1].uid).toBe(2)
  })

  it('gets an entire array but skips non uid array entities', function () {
    let item1 = { uid: 1 }
    let item2 = { uid: 2 }
    let item = { val: 'test' }
    one.put([item1, item2, item])
    let result = one.get([1, 2, item])
    expect(isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result[0].uid).toBe(1)
    expect(result[1].uid).toBe(2)
  })

  it('gets with functions', () => {
    let item = {
      uid: 1,
      do: () => 3,
    }
    one.put(item)
    expect(typeof one.get(1).do === 'function').toBe(true)
    expect(one.get(1).do()).toBe(3)
  })

  it('gets edit with functions', () => {
    let item = {
      uid: 1,
      func: () => 3,
    }
    item['dofunc'] = function () {
      return 5
    }
    expect(typeof item['dofunc'] === 'function').toBe(true)
    one.put(item)

    let result = one.getEdit(1)
    expect(result === item).toBe(false)
    expect(typeof result.func === 'function').toBe(true)
    expect(result.func()).toBe(3)

    expect(typeof result['dofunc'] === 'function').toBe(true)
    expect(result['dofunc']()).toBe(5)
  })

  it('gets edit with functions with new', () => {
    function Test() {
      let uid
    }
    Test.prototype.uid = 1
    Test.prototype.func = function () {
      return this.uid
    }

    let test1 = new Test()
    expect(test1.uid).toBe(1)
    expect(test1.func()).toBe(1)

    one.put(test1)
    let result = one.getEdit(1)
    expect(test1 === result).toBe(false)
    expect(typeof result.func === 'function').toBe(true)
    expect(result.uid).toBe(1)
    expect(result.func()).toBe(1)
  })

  it('should keep array editable on getEdit', () => {
    let item = {
      uid: 1,
      children: [
        'test',
        'more',
      ],
    }
    one.put(item)
    let result = one.getEdit(1)
    result.children = result.children.concat(['other'])
    expect(result.children.length).toBe(3)
    expect(result.children[0]).toBe('test')
    expect(result.children[1]).toBe('more')
    expect(result.children[2]).toBe('other')
  })

  it('should keep function on object', () => {
    class Test {
      uid: number = 1
      list: Array<String> = []
      addItems = (items: Array<string>) => {
        this.list = this.list.concat(items)
      }
      test = () => 'aha'
    }
    let test = new Test()
    one.put(test)
    let result = one.get(1)
    expect(typeof result.addItems === 'function').toBe(true)
    expect(Object.isFrozen(result.list)).toBe(true)
    expect(Object.isFrozen(result.getItems)).toBe(true)
    let editResult = one.getEdit(1)
    expect(typeof editResult.addItems === 'function').toBe(true)
    expect(Object.isFrozen(editResult.list)).toBe(false)
    expect(Object.isFrozen(editResult.addItems)).toBe(false)
    expect(editResult.test()).toBe('aha')
    // new function
    expect(editResult.test === test.test).toBe(false)
  })

  it('should keep object array editable on getEdit', () => {

    class Test {
      uid: number = 1
      list: Array<String> = []
      addItems = (items: Array<string>) => {
        this.list = this.list.concat(items)
      }
    }

    let test = new Test()
    expect(test.list.length).toBe(0)
    test.addItems(['value'])
    expect(test.list.length).toBe(1)
    expect(Object.isFrozen(test.list)).toBe(false)
    one.put(test)
    let result = one.getEdit(1)
    expect(result).toBeDefined()
    expect(Object.isFrozen(result.list)).toBe(false)
    expect(typeof result.addItems === 'function').toBe(true)
    let listDescriptor = Object.getOwnPropertyDescriptor(result, 'list')
    expect(listDescriptor.writable).toBe(true)
    expect(Object.isFrozen(result.addItems)).toBe(false)
    //result.list = result.list.concat(['test'])
    result.addItems(['test'])
    expect(result.list.length).toBe(2)
  })

  it('should clone function with multiple arguments', () => {
    class Test {
      uid: number = 1
      list: Array<String> = []
      addItems = (items: Array<string>, recursive: boolean) => {
        if (recursive) {
          this.list = this.list.concat(items)
        }
      }
    }

    let test = new Test()
    expect(test.list.length).toBe(0)
    test.addItems(['value'], true)
    expect(test.list.length).toBe(1)
    expect(Object.isFrozen(test.list)).toBe(false)
    one.put(test)
    let result = one.getEdit(1)
    expect(result).toBeDefined()
    expect(Object.isFrozen(result.list)).toBe(false)
    expect(typeof result.addItems === 'function').toBe(true)
    let listDescriptor = Object.getOwnPropertyDescriptor(result, 'list')
    expect(listDescriptor.writable).toBe(true)
    expect(Object.isFrozen(result.addItems)).toBe(false)
    result.addItems(['test'], true)
    expect(result.list.length).toBe(2)
  })

  it('should clone object with constructor', () => {
    function makeUid() {
      return 15
    }
    class Test {
      uid: number
      test: string
      constructor() {
        this.test = 'test'
        this.uid = makeUid()
      }
    }
    let test = new Test()
    one.put(test)
    let result = one.getEdit(15)
    expect(result).toBeDefined()
    expect(result.test).toBe('test')
  })

  it('should handle inheritance edit caching', () => {
    class Base {
      uid = One.uuid()
    }

    class Test extends Base {
      value: string = ''
    }

    let test = new Test()
    One.put(test)
    let result = One.getEdit(test)
    expect(result).toBeDefined()
    expect(result.uid).toBeDefined()
    expect(result.uid === test.uid).toBe(true)
  })
})
