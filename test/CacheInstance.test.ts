import 'jest'

import { CacheNode, ICacheNode } from "../src/CacheNode";

import CacheInstance from '../src/CacheInstance'
import CacheRepo from '../src/CacheRepo'
import CacheThread from '../src/CacheThread'
import { ICacheInstance } from "../src/CacheInstance";

describe('CacheInstance', () => {
  let instance: ICacheInstance

  beforeEach(() => {
    instance = new CacheInstance('one')
  })

  afterEach(() => {
    instance = null
  })

  it('creates cache instance', () => {
    expect(instance.repo).toBeDefined()
    expect(instance.repo instanceof CacheRepo).toBe(true)
    expect(instance.thread).toBeDefined()
    expect(instance.thread instanceof CacheThread).toBe(true)
    expect(instance.name).toBe('one')
    expect(instance.nextNodeKey).toBe(0)
  })

  it('adds node only once', () => {
    expect(instance.length()).toBe(0)
    let node: ICacheNode = new CacheNode(0)
    expect(instance.addNode(node)).toBe(true)
    expect(instance.length()).toBe(1)
    expect(instance.addNode(node)).toBe(false)
    expect(instance.length()).toBe(1)
    expect(instance.size()).toBe(1)
  })

  it('adds multiple nodes', () => {
    for (let i = 0; i < 3; i++) {
      let node: ICacheNode = new CacheNode(i)
      instance.addNode(node)
    }
    expect(instance.length()).toBe(3)
    expect(instance.size()).toBe(3)
  })
})
