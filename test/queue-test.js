/**
 * Created by maierdesign on 12/20/15.
 */
import {
    expect,
    sinon,
    print,
    contains
} from './test_helper';
import createCache from '../src/cache';
import * as config from '../src/utils/config';
import {deepClone, isArray} from '../src/utils/clone';
import * as path from "../src/utils/path";
import {describe, it} from 'mocha/lib/mocha.js';

describe("Queue", function () {

    "use strict";

    let One;

    function printCache() {
        print(One, "CACHE");
    }

    beforeEach(function () {
        One = createCache(true);
        // reset config before each call
        One.config({
            uidName         : "uid",
            maxHistoryStates: 1000
        })
    });

    afterEach(function () {
        One.reset();
    });

    it("clears the cache queue for each test run", function () {
        One.queue({uid: 1});
        One.commit();

        expect(One.size()).to.equal(1);
        expect(One.length()).to.equal(1);

        One.reset();
        expect(One.size()).to.equal(0);
        expect(One.length()).to.equal(0);
    });

    it("maintains identity items on put if not changed", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid: 2, item: item1
        };
        One.queue(item2);
        One.commit();

        let result1 = One.get(1);
        let result2 = One.get(2);
        expect(item1 === result1).to.be.true;
        expect(item2 === result2).to.be.true;
    });

    it("maintains identity of inner items on commit if not changed", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid: 2, item: item1
        };
        One.queue(item2);
        One.commit();

        let editable  = One.getEdit(2);
        editable.text = "test";
        One.put(editable);
        expect(One.get(1) === item1).to.be.true;
        expect(One.get(2) === item2).to.be.false;
        expect(One.get(2).text).to.equal("test");
    });

    it("gets edit undefined if not existing", function () {
        expect(One.getEdit(1)).to.be.undefined;
    });

    it("gets editable from the queue", function () {
        One.queue({uid: 1});
        expect(One.getEdit(1)).to.not.be.undefined;
    });

    it("gets from cache if existing both in queue and cache", function () {
        let item = {uid: 1};
        One.put(item);

        let item1 = {uid: 1, text: "text"};
        One.queue(item1, true);

        let result = One.get(1);
        expect(result.text).to.be.undefined;

        let queued = One.getQueued(1);
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
        One.queue(item3);
        expect(One.size()).to.equal(0);
        expect(One.length()).to.equal(0);
        expect(One.get(1)).to.be.undefined;
        expect(One.get(2)).to.be.undefined;
        expect(One.get(3)).to.not.be.undefined;

        expect(Object.isFrozen(One.get(3))).to.be.false;
    });

    it("finds queued item", function () {
        One.queue({uid: 1});
        expect(One.getQueued(1)).to.not.be.undefined;
    });

    it("unQueues item previously queued", function () {
        One.queue({uid: 1});
        One.unQueue(1);
        expect(One.getQueued(1)).to.be.undefined;
        expect(One.get(1)).to.be.undefined;
    });

    it("returns undefined on not real uid", function () {
        expect(One.unQueue(true)).to.be.undefined;
    });

    it("returns false on not existing uid", function () {
        expect(One.unQueue(123)).to.be.false;
    });

    it("returns false history state on commiting empty queue", function () {
        expect(One.commit().success).to.be.false;
    });

    it("doesn't get queued if not real uid", function () {
        expect(One.getQueued(true)).to.be.undefined;
    });

    it("queues for evict if valid uid entity", function () {
        expect(One.queueEvict({uid: 1})).to.be.true;
    });

    it("doesn't queue for evict if no uid", function () {
        expect(One.queueEvict({})).to.be.false;
    });

    it("doesn't queue for evict if no entity", function () {
        expect(One.queueEvict()).to.be.false;
    });

    it("does not replace existing cached entity when putting shallow", function () {
        let item = {uid: 1};
        One.put(item);
        let itemUpdate = {uid: 1, value: "val"};
        One.put(item, "main", false);
        let result = One.get(1);
        expect(result.val).to.be.undefined;
    });

    it("commits queue on commit", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2, item: item1};
        let item3 = {uid: 3, items: [item1]};
        One.queue([item2, item3]);
        One.commit();
        expect(One.get(1)).to.not.be.undefined;
        expect(One.get(2)).to.not.be.undefined;
        expect(One.get(3)).to.not.be.undefined;
        expect(One.pending().queue).to.equal(0);
    });

    it("commits queue without replacing existing on weak commit with array", function () {
        let item1 = {uid: 1};
        One.put(item1);
        let item1a = {uid: 1, text: "test"};
        let item2  = {uid: 2, item: item1};
        let item3  = {uid: 3, items: [item1]};
        One.queue([item1a, item2, item3]);
        One.commit();
        let result1 = One.get(1);
        expect(result1).to.not.be.undefined;
        expect(result1.text).to.be.undefined;
        expect(One.get(2)).to.not.be.undefined;
        expect(One.get(3)).to.not.be.undefined;
        expect(One.pending().queue).to.equal(0);
    });

    // doesn't replace existing items in the cache even if they are different when commit is weak
    it("commits weak correctly", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid : 2,
            item: item1
        };
        One.put(item2);
        let newItem1 = {uid: 1, text: "test"};
        let count    = One.queue(newItem1);
        expect(count).to.equal(0);

        count = One.queue(newItem1, true);
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
        One.put(item);

        let item2 = {
            uid : 4,
            item: {uid: 2, text: "test"}
        };
        One.queue(item2);
        let result = One.get(2);
        expect(result.text).to.be.undefined;
        One.commit("main", true);
        result = One.get(2);
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
        One.put(item2);
        expect(One.refTo(2)["1"][0]).to.equal("children.0");
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
        One.put(item2);
        expect(One.refTo(2)["1"][0]).to.equal("children.0.item.refs.1.inner");
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
        One.put(item);

        let item2 = {
            uid : 4,
            item: [{
                item: {
                    val: {uid: 2, text: "test"}
                }
            }]
        };
        One.queue(item2);
        let result = One.get(2);
        expect(result.text).to.be.undefined;
        One.commit("main", true);
        result      = One.get(2);
        let refFrom = One.refFrom(2);
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
        One.queue([item3, item4]);
        expect(One.size()).to.equal(0);
        expect(One.length()).to.equal(0);
        expect(One.get(1)).to.be.undefined;
        expect(One.get(2)).to.be.undefined;
        expect(One.get(3)).to.not.be.undefined;
        expect(Object.isFrozen(One.get(3))).to.be.false;
        expect(One.get(4)).to.not.be.undefined;
        expect(Object.isFrozen(One.get(4))).to.be.false;
    });

    it("queues entities and commits correctly", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2, item: item1};
        let item3 = {uid: 3};
        let item4 = {uid: 4, items: [item1, item2, item3]};
        One.queue(item1);
        One.queue(item2);
        One.queue(item4);
        One.commit();
        expect(One.size()).to.equal(4);
        expect(One.length()).to.equal(1);

        // verify that the pool was cleared
        One.reset();
        //One.commit();
        expect(One.size()).to.equal(0);
        expect(One.length()).to.equal(0);
    });

    it("doesn't replace in queue when existing in cache on weak put", function () {
        let item = {uid: 1};
        One.put(item);
        let item2 = {uid: 1, text: "text"};
        // weak queuing
        One.queue(item2, false);
        expect(One.get(1).text).to.be.undefined;
    });

    it("doesn't replace in queue when existing in cache on strong put", function () {
        let item = {uid: 1};
        One.put(item);
        let item2 = {uid: 1, text: "text"};
        // weak queuing
        One.queue(item2);
        expect(One.get(1).text).to.be.undefined;
    });

    it("replaces the queue even if it exists on strong put", function () {
        let item = {uid: 1};
        One.queue(item);
        let itemEdit = {uid: 1, text: "text"};
        One.queue(itemEdit);
        expect(One.get(1).text).to.be.undefined;
        expect(One.pending().queue).to.equal(1);
        One.queue(itemEdit, true);
        expect(One.get(1).text).to.equal("text");
        expect(One.pending().queue).to.equal(1);
    });

    it("removes from queue once an item is put", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2, item: item1};
        // put shallow
        One.queue(item1);
        One.queue(item2);
        expect(One.pending().queue).to.equal(2);
        expect(One.size()).to.equal(0);
        One.put(item2);
        expect(One.pending().queue).to.equal(0);
        expect(One.size()).to.equal(2);
    });

    it("keeps identity when committing a queue", function () {
        let item1 = {uid: 1};
        One.queue(item1);
        expect(One.length()).to.equal(0);
        // strong commit clears the queue
        One.commit();
        expect(One.length()).to.equal(1);
        expect(One.pending().queue).to.equal(0);
        let result = One.get(1);
        expect(item1 === result).to.be.true;
    });

    it("clears the queue on commit", function () {
        One.queue({uid: 1});
        One.queue({uid: 2});
        One.commit();
        expect(One.getQueued(1)).to.be.undefined;
        expect(One.getQueued(2)).to.be.undefined;
        expect(One.get(1)).to.not.be.undefined;
        expect(One.get(2)).to.not.be.undefined;
    })
});


