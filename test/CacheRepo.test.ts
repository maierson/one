import 'jest'

import CacheInstance, { ICacheInstance } from '../src/CacheInstance'
import { CacheNode, ICacheNode } from '../src/CacheNode'

import CacheMap from '../src/CacheMap'
import CacheRepo from '../src/CacheRepo'
import CacheThread from '../src/CacheThread'

describe('CacheRepo', () => {
  let repo: CacheRepo

  beforeEach(() => {
    repo = new CacheRepo()
  })

  afterEach(() => {
    repo = null
  })

  it('creates cache instance', () => {
    expect(repo.items instanceof CacheMap).toBe(true)
    expect(repo.length).toBe(0)
    expect(typeof repo.get === 'function').toBe(true)
    expect(typeof repo.add === 'function').toBe(true)
    expect(typeof repo.delete === 'function').toBe(true)
  })

  it('adds node to the repo', () => {
    let node: ICacheNode = new CacheNode(0)
    repo.add(node)
    let node1: ICacheNode = new CacheNode(1)
    let node2: ICacheNode = new CacheNode(2)
    repo.add(node)
    repo.add(node1)
    repo.add(node2)
    expect(repo.length).toBe(3)
    expect(repo.get(2)).toBe(node2)
    expect(repo.get(1)).toBe(node1)
    expect(repo.get(0)).toBe(node)
  })

  it('adds deletes from the repo', () => {
    let node: ICacheNode = new CacheNode(0)
    let node1: ICacheNode = new CacheNode(1)
    let node2: ICacheNode = new CacheNode(2)
    repo.add(node)
    repo.add(node1)
    repo.add(node2)
    repo.delete(1)
    expect(repo.length).toBe(2)
    expect(repo.get(2)).toBe(node2)
    expect(repo.get(0)).toBe(node)
    expect(repo.get(1)).toBeUndefined()
  })
})
