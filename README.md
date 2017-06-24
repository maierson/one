![One logo](https://lh3.googleusercontent.com/5CBS5xCZm0BQQ9GaE8SfDnomFNWkr5jU-ZPRi_Cdptj7__GSyRPCeQbQA1OBxt0OZ3LNs-a_eGiyBSCtOM4=s100 "One logo")

# **ONE** #

```One``` is a browser side application cache. It guarantees entity uniqueness across the entire cache.

[![Npm Status](https://badge.fury.io/js/one.svg)](https://npmjs.com/package/one-typescript) [![Build Status](https://travis-ci.org/maierson/one.svg)](https://travis-ci.org/maierson/one) [![Coverage Status](https://coveralls.io/repos/github/maierson/one/badge.svg?branch=master)](https://coveralls.io/github/maierson/one?branch=master)

Each entity tracked for uniqueness must have a unique id. There is precisely ONE distinct entity in the cache
for each unique id. Entities that do not have a unique id are still cached but not tracked for uniqueness.

- [Changes](#changes)
- [Api](#api)
- [Usage](#usage)
- [Immutable](#immutable)
- [Configuration](#configuration)
- [Motivation](#motivation)
- [Performance](#performance-considerations)
- [Data shape](#data-shape)

### __Changes__
1. Complete rewrite in typescript.
2. Fix some subtle bugs related to object structure (ie modifiying arrays would sometimes behave unpredictably based on the parent's structure).
3. Remove the need for ```babel-polyfill```
4. __Breaking api changes:__ Simplified minimal api. You really only need the commands in the table below. There are a couple of other options mostly for debugging (see the Api section for the development api list).

| Command      | Action                                                                                                                                                                                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| __getCache__ | Create or access a specific version of the cache. There can be multiple concurrent versions of the cache in case distinct versions of the same entity are needed (for example if display and edit data need to be different until a user commits changes). ```One.getCache('edit')   ``` would create a cache dedicated to edit operations. |
| __put__      | Add an entity to the cache and make it immutable.                                                                                                                                                                                                                                                                                           |
| __get__      | Retrieve an entity from the cache. This is a fast hash map locator.                                                                                                                                                                                                                                                                         |
| __getEdit__  | Get a shallow editable version of the entity from the cache. Inner nested entities are still immutable. This is in order to make efficient use of trie structures.                                                                                                                                                                          |
| __evict__    | Remove an entity from the cache. Evicts it from all parents as well.                                                                                                                                                                                                                                                                        |


### __Api__
In addition to the 5 production api commands there are 4 options intended for development:

| Command    | Action                                                                                                                                         |
| ---------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| __reset__  | Resets the cache to empty. Useful for testing.                                                                                                 |
| __length__ | Number of nodes in the current cache. Each node contains one atomic change to the cache so moving between nodes gives you time  travelling.    |
| __size__   | Number of entities cached on the current node (the size of the node).                                                                          |
| __print__  | Provides a printable representation of the entire cache that can be passed on to a logger. Slow. For debugging only. Do not use in production. |


### __Usage__

```js
npm install one --save
```
or
```js
yarn add one
```
Use it
```js
import * as One from 'one'

// get a hold of an instance
let one = One.getCache()

// you can then use the instance to cache items
one.put(item)

// One.getCache() is a singleton so you can also do this
One.getCache().put(item)

// or if you are only using the default instance of the cache
One.put(item)
```

Or simply put ```one.min.js``` on your page to access the ```One``` global variable from anywhere. In this case the instance is created for you and you can access it directly.


```js
One.put(item)
```

Some code

```js
let item1 = { uid:1 }
let item2 = { uid:2, ref:item1 }

One.put(item2)

// puts all items with uid separately in the cache

One.get(item1) === undefined // false (item1 is added from item2)
item1 === One.get(item1) // true (same object)
item2.ref === One.get(1) // true
```

### __Immutable__
All data is immutable. Once an item enters the cache it freezes and cannot change. This is to enable quick identity checks against immutable entities (ie React / Redux identity check).

```js
let item = { uid:1 }
Object.isFrozen(item) // false

One.put(item);
Object.isFrozen(item) // true

let result = One.get(item)
result === item // true
```

If you later want to edit a reference of the object you can get an editable copy from the cache. This gives you a separate clone of the object that is now editable:

```js
let item = { uid:1 }
One.put(item)

let editable = One.getEdit(1) // or cuid.getEditable(item1);
Object.isFrozen(editable) // false
item === editable // false

editable.text = "test"
One.put(editable)

let edited = One.get(1)
edited.text = "text" // true
Object.isFrozen(edited) // true
```
__Important__ Edit clones are shallow. If you want to edit a nested child that also has a uid you must get an editable copy of the child.

```js
const item1 = { uid:1 } // uid item cached separately
const item2 = { value: 'test' } // item has no uid - it will be cloned for edit
const item = {
  uid: 1,
  item1,
  item2
}

one.put(item)

const editable = one.getEdit(item)

Object.isFrozen(editable.item1) // true - item1 has a uid - not cloned
item1 === editable.item1 // true

Object.isFrozen(editable.item2) // false item2 has no uid - it will be cloned
item2 === editable.item2 // false
```

Editing an item changes all its instances in the cache:

```js
let item = { uid:1 }
let item2 = { uid:2, child:item }

One.put(item2)

One.get(1) === item // true
One.get(2) === item2 // true

// Let's do some editing
let editable = One.getEdit(1);
editable.text = "test"
One.put(editable) // also updates item2 reference to item

let result = One.get(2)
console.log(JSON.stringify(result.item)) // {uid:1, text:"test"}
```
### __Configuration__

For existing code bases the name of the `uid` property can be configured via a config object passed as a second argument to the `.getCache()` method. In order for this to work correctly the values held by the configured property must be unique across all instances.

```js
const one = One.getCache('test', { uidName:'id' })

const item = { id:'unique_id_value' }

one.put(item)

one.get('unique_id_value') !== undefined // true (works)
```

### __Motivation__
More an more applications are giving users the ability to edit data in the browser.
With a normalized data model various instances of an entity can exist at the same time in different locations. This depends on how data is received from the server and added to the local model / store.

This is inconvenient because:
* Keeping all the instances in sync can be a daunting task.
* It can make debugging hard.
* It requires tracking each instance and makes reasoning about data complicated.
* It can make the application structure needlessly complex.

[Redux](https://github.com/reactjs/redux) brings a great breakthrough by putting the entire application state in one place and mutating it only via dispatched actions. But it doesn't enforce entity uniqueness. ```One``` aims to take the concept a step further by making each entity unique and immutable in a single store (cache).

### __Performance considerations__

* __Read optimized__: Yes there is a performance cost in analyzing each entity deeply to track its dependencies. ```One``` mitigates this by being read optimized. The penalty is incurred on write operations only. These happen a lot less frequently than read ops. Read ops are super fast (a simple key lookup).
* __Trie structures__: Data is stored in a trie like structure. This way all entities are referenced (not copied) and minimal changes are performed on every put or getEdit operation.

### __Data shape__
This is not currently designed to work with cyclical data. It is best for non-cyclical objects received from the server in the form of json (or other non-cyclical fomats).
It might happen later if there's a need.