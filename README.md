# One

```One``` is a browser side application cache. It guarantees entity uniqueness across the entire cache.

[![Npm Status](https://badge.fury.io/js/one.svg)](https://npmjs.com/package/one) [![Build Status](https://travis-ci.org/maierson/one.svg)](https://travis-ci.org/maierson/one) [![Coverage Status](https://coveralls.io/repos/github/maierson/one/badge.svg?branch=master)](https://coveralls.io/github/maierson/one?branch=master)

Each entity tracked for uniqueness must have a unique id. There is precisely ONE distinct entity in the cache 
for each unique id. Entities that do not have a unique id are still cached but not tracked for uniqueness.

###Usage

```
npm install one --save
```

```js
import * as cache from 'one';
let One = cache.createCache();

// or with debugging options
let One = cache.createCache(true);
```

###Api
There are three significant operation types to be aware of:
* **[put](https://maierson.gitbooks.io/one/content/put.html) / [get](https://maierson.gitbooks.io/one/content/get.html) / [evict](https://maierson.gitbooks.io/one/content/evict.html)** - items go into the cache with a ```put``` operation and come out with a ```get``` call. Use ```evict``` to force items out of the cache.
* **[queue](https://maierson.gitbooks.io/one/content/queue.html)** - fast input to bypass uniqueness tracking
* **[time travel](https://maierson.gitbooks.io/one/content/time_travel.html)** - ```undo()``` and ```redo()``` to go back and forth in time

Some code

```js
let item1 = {uid:1}
let item2 = {uid:2, ref:item1}
One.put(item2)

// puts all items with uid separately in the cache

One.get(item1) === undefined // false (item1 is added from item2)
item1 === One.get(item1) // true (same object)
item2.ref === One.get(1) // true
```

###Threading
```One``` can place entities on separate [threads](https://maierson.gitbooks.io/one/content/threads.html) for a granular control of the time travelling mechanism.

```js
let item1 = {uid:1}
One.put(item1, "thread1") // item1 is on 2 threads "main" and "thread1"

let editable = One.get(1)
editable.text = "background"
One.put(editable) // editable is on "main" thread only

let otherEditable = One.get(1)
otherEditable.text = "thread1Edited"
One.put(otherEditable, "thread1") // otherEditable is on "main" and "thread1"

// time travel can now be done on either "main" thread or "thread1"
// on thread1
One.get(1).text // "thread1Edited"
// also 
One.get(1, "thread1").text // "thread1Edited" both threads are left on their last put operation

// travel back on thread1 = to the first put operation
One.undo("thread1")
One.get(1, "thread1").text // undefined (jumped straight to the first node)

// but
One.get(1).text // still "thread1Edited" as the main thread is still positioned at the last node where we left it

// now travel on main thread. "main" thread is left 
// where it was after the last put operation 
// (threads can travel separately)
One.undo()
One.get(1).text // "background"

One.undo()
One.get(1).text // undefined
One.redo()
One.get(1).text // "background"
```

###Immutable 
All data is immutable. Once an item enters the cache it freezes and cannot change. This is to enable quick identity checks against immutable entities (ie React identity check). 

```js
let item = {uid:1}
Object.isFrozen(item) // false

One.put(item);
Object.isFrozen(item) // true

let result = One.get(item)
result === item // true
```

If you later want to edit a reference of the object you can get an editable copy from the cache. This gives you a separate clone of the object that is now editable:

```js
let item = {uid:1}
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

Editing an item changes all its instances in the cache:

```js
let item = {uid:1}
let item2 = {uid:1, child:item}
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


###Motivation
More an more applications are giving users the ability to edit data in the browser. 
With a normalized data model various instances of an entity can exist at the same time in different locations. This depends on how data is received from the server and added to the local model / store. 

This is inconvenient because: 
* Keeping all the instances in sync can be a daunting task. 
* It can make debugging hard. 
* It requires tracking each instance and makes reasoning about data complicated. 
* It can make the application structure needlessly complex.

[Redux](https://github.com/reactjs/redux) brings a great breakthrough by putting the entire application state in one place and mutating it only via dispatched actions. But it doesn't enforce entity uniqueness. ```One``` aims to take the concept a step further by making each entity unique and immutable in a single store (cache).

###Performance considerations
Yes there is a performance cost in analyzing each entity deeply to track its dependencies. ```One``` offers a couple of ways to mitigate this: **Read optimization** and **Queuing**. 
* **Read optimized**: the penalty is incurred on write operations only. These happen a lot less frequently than read ops. Read ops are super fast (a simple key lookup).
* **Queuing** allows the developer to choose when to perform the write operation. ```One``` defers the write analysis when writing to the queue. The queue can commit between render operations. This way the UI remains fluid.   
If you were to track all instances of an entity on each update the write penalty could end up being comparably high. This is besides the added complexity introduced by such tracking management.

###Data shape
This is not currently designed to work with cyclical data. It is best for non-cyclical objects received from the server in the form of json (or other non-cyclical fomats).  
If a strong need arises for managing cyclical structures this might be an option for future development.

###Documentation
* [Immutable data](https://maierson.gitbooks.io/one/content/immutable_data.html)
* Api
  * [Put](https://maierson.gitbooks.io/one/content/put.html)
  * [Get](https://maierson.gitbooks.io/one/content/get.html)
  * [Evict](https://maierson.gitbooks.io/one/content/evict.html)
* [Threads](https://maierson.gitbooks.io/one/content/threads.html)
* [Time travel](https://maierson.gitbooks.io/one/content/time_travel.html)

    
