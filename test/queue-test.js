/**
 * Created by maierdesign on 12/20/15.
 */
import {
    expect,
    sinon,
    print,
    contains
} from './test_helper';
import {getCache} from '../src/cache';
import * as config from '../src/utils/config';
import {deepClone, isArray} from '../src/utils/clone';
import * as path from "../src/utils/path";
import {describe, it} from 'mocha/lib/mocha.js';

describe("Queue", function () {

    "use strict";

    let one;

    function printCache() {
        print(one, "CACHE");
    }

    beforeEach(function () {
        one = getCache(true);
        // reset config before each call
        one.config({
            uidName         : "uid",
            maxHistoryStates: 1000
        })
    });

    afterEach(function () {
        one.reset();
    });

    it("clears the cache queue for each test run", function () {
        one.queue({uid: 1});
        one.commit();

        expect(one.size()).to.equal(1);
        expect(one.length()).to.equal(1);

        one.reset();
        expect(one.size()).to.equal(0);
        expect(one.length()).to.equal(0);
    });

    it("maintains identity items on put if not changed", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid: 2, item: item1
        };
        one.queue(item2);
        one.commit();

        let result1 = one.get(1);
        let result2 = one.get(2);
        expect(item1 === result1).to.be.true;
        expect(item2 === result2).to.be.true;
    });

    it("maintains identity of inner items on commit if not changed", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid: 2, item: item1
        };
        one.queue(item2);
        one.commit();

        let editable  = one.getEdit(2);
        editable.text = "test";
        one.put(editable);
        expect(one.get(1) === item1).to.be.true;
        expect(one.get(2) === item2).to.be.false;
        expect(one.get(2).text).to.equal("test");
    });

    it("gets edit undefined if not existing", function () {
        expect(one.getEdit(1)).to.be.undefined;
    });

    it("gets editable from the queue", function () {
        one.queue({uid: 1});
        expect(one.getEdit(1)).to.not.be.undefined;
    });

    it("gets from cache if existing both in queue and cache", function () {
        let item = {uid: 1};
        one.put(item);

        let item1 = {uid: 1, text: "text"};
        one.queue(item1, true);

        let result = one.get(1);
        expect(result.text).to.be.undefined;

        let queued = one.getQueued(1);
        expect(queued).to.not.be.undefined;
        expect(queued.text).to.equal("text");
    });

    it("puts shallow entities without any references", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2};
        let item3 = {
            uid  : 3,
            item : item1,
            items: [item2]
        };
        one.queue(item3);
        expect(one.size()).to.equal(0);
        expect(one.length()).to.equal(0);
        expect(one.get(1)).to.be.undefined;
        expect(one.get(2)).to.be.undefined;
        expect(one.get(3)).to.not.be.undefined;

        expect(Object.isFrozen(one.get(3))).to.be.false;
    });

    it("finds queued item", function () {
        one.queue({uid: 1});
        expect(one.getQueued(1)).to.not.be.undefined;
    });

    it("unQueues item previously queued", function () {
        one.queue({uid: 1});
        one.unQueue(1);
        expect(one.getQueued(1)).to.be.undefined;
        expect(one.get(1)).to.be.undefined;
    });

    it("returns undefined on not real uid", function () {
        expect(one.unQueue(true)).to.be.undefined;
    });

    it("returns false on not existing uid", function () {
        expect(one.unQueue(123)).to.be.false;
    });

    it("returns false history state on commiting empty queue", function () {
        expect(one.commit().success).to.be.false;
    });

    it("doesn't get queued if not real uid", function () {
        expect(one.getQueued(true)).to.be.undefined;
    });

    it("queues for evict if valid uid entity", function () {
        expect(one.queueEvict({uid: 1})).to.be.true;
    });

    it("doesn't queue for evict if no uid", function () {
        expect(one.queueEvict({})).to.be.false;
    });

    it("doesn't queue for evict if no entity", function () {
        expect(one.queueEvict()).to.be.false;
    });

    it("does not replace existing cached entity when putting shallow", function () {
        let item = {uid: 1};
        one.put(item);
        let itemUpdate = {uid: 1, value: "val"};
        one.put(item, "main", false);
        let result = one.get(1);
        expect(result.val).to.be.undefined;
    });

    it("commits queue on commit", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2, item: item1};
        let item3 = {uid: 3, items: [item1]};
        one.queue([item2, item3]);
        one.commit();
        expect(one.get(1)).to.not.be.undefined;
        expect(one.get(2)).to.not.be.undefined;
        expect(one.get(3)).to.not.be.undefined;
        expect(one.pending().queue).to.equal(0);
    });

    it("commits queue without replacing existing on weak commit with array", function () {
        let item1 = {uid: 1};
        one.put(item1);
        let item1a = {uid: 1, text: "test"};
        let item2  = {uid: 2, item: item1};
        let item3  = {uid: 3, items: [item1]};
        one.queue([item1a, item2, item3]);
        one.commit();
        let result1 = one.get(1);
        expect(result1).to.not.be.undefined;
        expect(result1.text).to.be.undefined;
        expect(one.get(2)).to.not.be.undefined;
        expect(one.get(3)).to.not.be.undefined;
        expect(one.pending().queue).to.equal(0);
    });

    // doesn't replace existing items in the cache even if they are different when commit is weak
    it("commits weak correctly", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid : 2,
            item: item1
        };
        one.put(item2);
        let newItem1 = {uid: 1, text: "test"};
        let count    = one.queue(newItem1);
        expect(count).to.equal(0);

        count = one.queue(newItem1, true);
        expect(count).to.equal(1);
    });

    it("replaces cache items on commit strong", function () {
        let item = {
            uid  : 1,
            item : {uid: 2},
            items: [{uid: 2}],
            inner: {
                uid : 3,
                item: {uid: 2}
            }
        };
        one.put(item);

        let item2 = {
            uid : 4,
            item: {uid: 2, text: "test"}
        };
        one.queue(item2);
        let result = one.get(2);
        expect(result.text).to.be.undefined;
        one.commit("main", true);
        result = one.get(2);
        expect(result.text).to.equal("test");
    });

    it("builds correct refTo path inside simple array", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid     : 2,
            children: [
                item1
            ]
        };
        one.put(item2);
        expect(one.refTo(2)["1"][0]).to.equal("children.0");
    });

    it("builds correct refTo path inside array", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid     : 2,
            children: [
                {
                    item: {
                        refs: [
                            {val: "random"},
                            {
                                inner: item1
                            }
                        ]
                    }
                }
            ]
        };
        //let item2 = {
        //    uid : 2,
        //    item: {
        //        children: [{
        //            item: item1
        //        }]
        //    }
        //};
        one.put(item2);
        expect(one.refTo(2)["1"][0]).to.equal("children.0.item.refs.1.inner");
    });

    it("replaces cache items deeply on commit strong", function () {
        let item = {
            uid  : 1,
            item : {uid: 2},
            items: [{uid: 2}],
            inner: {
                uid : 3,
                item: {uid: 2}
            }
        };
        one.put(item);

        let item2 = {
            uid : 4,
            item: [{
                item: {
                    val: {uid: 2, text: "test"}
                }
            }]
        };
        one.queue(item2);
        let result = one.get(2);
        expect(result.text).to.be.undefined;
        one.commit("main", true);
        result      = one.get(2);
        let refFrom = one.refFrom(2);
        expect(refFrom["4"]).to.not.be.undefined;
        expect(refFrom["4"][0]).to.equal("item.0.item.val");
        expect(result.text).to.equal("test");
    });

    it("puts array of shallow entities without any references", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2};
        let item3 = {
            uid  : 3,
            item : item1,
            items: [item2]
        };
        let item4 = {
            uid : 4,
            item: item2
        };
        one.queue([item3, item4]);
        expect(one.size()).to.equal(0);
        expect(one.length()).to.equal(0);
        expect(one.get(1)).to.be.undefined;
        expect(one.get(2)).to.be.undefined;
        expect(one.get(3)).to.not.be.undefined;
        expect(Object.isFrozen(one.get(3))).to.be.false;
        expect(one.get(4)).to.not.be.undefined;
        expect(Object.isFrozen(one.get(4))).to.be.false;
    });

    it("queues entities and commits correctly", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2, item: item1};
        let item3 = {uid: 3};
        let item4 = {uid: 4, items: [item1, item2, item3]};
        one.queue(item1);
        one.queue(item2);
        one.queue(item4);
        one.commit();
        expect(one.size()).to.equal(4);
        expect(one.length()).to.equal(1);

        // verify that the pool was cleared
        one.reset();
        //One.commit();
        expect(one.size()).to.equal(0);
        expect(one.length()).to.equal(0);
    });

    it("doesn't replace in queue when existing in cache on weak put", function () {
        let item = {uid: 1};
        one.put(item);
        let item2 = {uid: 1, text: "text"};
        // weak queuing
        one.queue(item2, false);
        expect(one.get(1).text).to.be.undefined;
    });

    it("doesn't replace in queue when existing in cache on strong put", function () {
        let item = {uid: 1};
        one.put(item);
        let item2 = {uid: 1, text: "text"};
        // weak queuing
        one.queue(item2);
        expect(one.get(1).text).to.be.undefined;
    });

    it("replaces the queue even if it exists on strong put", function () {
        let item = {uid: 1};
        one.queue(item);
        let itemEdit = {uid: 1, text: "text"};
        one.queue(itemEdit);
        expect(one.get(1).text).to.be.undefined;
        expect(one.pending().queue).to.equal(1);
        one.queue(itemEdit, true);
        expect(one.get(1).text).to.equal("text");
        expect(one.pending().queue).to.equal(1);
    });

    it("removes from queue once an item is put", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2, item: item1};
        // put shallow
        one.queue(item1);
        one.queue(item2);
        expect(one.pending().queue).to.equal(2);
        expect(one.size()).to.equal(0);
        one.put(item2);
        expect(one.pending().queue).to.equal(0);
        expect(one.size()).to.equal(2);
    });

    it("keeps identity when committing a queue", function () {
        let item1 = {uid: 1};
        one.queue(item1);
        expect(one.length()).to.equal(0);
        // strong commit clears the queue
        one.commit();
        expect(one.length()).to.equal(1);
        expect(one.pending().queue).to.equal(0);
        let result = one.get(1);
        expect(item1 === result).to.be.true;
    });

    it("clears the queue on commit", function () {
        one.queue({uid: 1});
        one.queue({uid: 2});
        one.commit();
        expect(one.getQueued(1)).to.be.undefined;
        expect(one.getQueued(2)).to.be.undefined;
        expect(one.get(1)).to.not.be.undefined;
        expect(one.get(2)).to.not.be.undefined;
    })
});


