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

describe("References", function () {

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

    it("updates pointers correctly when putting via an entity reference", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid : 2,
            item: item1
        };
        one.put([item2]);
        item1      = one.getEdit(1);
        item1.text = "test";
        one.put(item1);
        expect(one.size()).to.equal(2);
        expect(one.length()).to.equal(2);
        let result = one.get(2);
        expect(result.item.text).to.equal("test");
    });

    it("updates pointers deeply when putting via an entity reference", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid : 2,
            item: item1
        }
        let item3 = {
            uid : 3,
            item: item2
        }
        one.put(item3);
        let cached2 = one.get(2);
        let cached3 = one.get(3);
        item1       = one.getEdit(1);
        item1.text  = "test";
        one.put(item1);
        let result2 = one.get(2);
        expect(cached2 === result2).to.be.false;
        expect(result2.item.text).to.equal("test");
        let result3 = one.get(3);
        expect(cached3 === result3).to.be.false;
        expect(result3.item.item.text).to.equal("test");
    });

    it("updates pointers deeply when nested inside non uid objects", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid : 2,
            item: {
                item: item1
            }
        }
        one.put(item2);
        item1      = one.getEdit(1);
        item1.text = "test";
        one.put(item1);

        let result2 = one.get(item2);

        expect(result2 === item2).to.be.false;
        expect(result2.item === item2.item).to.be.false;
        expect(result2.item.item.text).to.equal("test");

        // compare to the previous instance of item1
        one.undo();
        let result1 = one.get(1);
        expect(result2.item.item === result1).to.be.false;
    });

    it("updates pointers when nested inside arrays", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid  : 2,
            items: [item1]
        }
        one.put(item2);
        item1      = one.getEdit(1);
        item1.text = "test";
        one.put(item1);

        ;

        let result2 = one.get(2);
        expect(result2.items[0].text).to.equal("test");

    });

    it("updates pointers deeply when nested inside arrays", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid  : 2,
            items: [
                [item1]
            ]
        };
        one.put(item2);
        item1      = one.getEdit(item1);
        item1.text = "test";
        one.put(item1);
        ;
        let result = one.get(2);
        expect(result.items[0][0].text).to.equal("test");
        one.undo();
        let result1 = one.get(1);
        expect(result.items[0][0] === result1).to.be.false;
    });

    it("keeps previous version pointers when it updates the new ones", function () {
        let item1 = {uid: 1};
        one.put(item1);
        let item = {
            uid : 2,
            item: item1
        };
        one.put(item);
        let resultOne = one.get(1);
        // rewind one and check again
        one.undo();
        expect(one.contains(2)).to.be.false;
        let resultTwo = one.get(1);
        expect(resultOne === resultTwo).to.be.true;
    });

    it("leaves previous pointer set intact when entity is evicted on current state", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2, item: item1};
        one.put(item2);

        let item3 = {uid: 3, item: item1};
        one.put(item3);

        one.evict(1);
        expect(one.length()).to.equal(3);
        expect(one.size()).to.equal(2);
        expect(one.get(1)).to.be.undefined;
        expect(one.get(2)).to.not.be.undefined;
        expect(one.get(3)).to.not.be.undefined;

        one.undo();
        expect(one.get(1)).to.not.be.undefined;

        // verify pointers
        one.evict(item2);
        expect(one.length()).to.equal(3);
        expect(one.size()).to.equal(2);
        expect(one.get(1)).to.not.be.undefined;
        expect(one.get(2)).to.be.undefined;
        expect(one.get(3)).to.not.be.undefined;

        one.evict(item3);
        expect(one.length()).to.equal(4);
        expect(one.size()).to.equal(0);
    });

    it("updates entity in other reference pointer on same entity", function () {
        let item1 = {uid: 1, val: "one"};
        // test object ref AND array at the same time
        let item2 = {
            uid      : 2,
            item     : item1,
            items    : [item1],
            otherItem: item1
        };
        one.put(item2);

        let editable2       = one.getEdit(2);
        editable2.otherItem = {
            uid: 1,
            val: "two"
        };
        one.put(editable2);

        let result = one.get(item2);
        expect(result.item.val).to.equal("two");
        expect(result.items[0].val).to.equal("two");
    });

    it("updates pointers array when putting through another entity", function () {
        let item1 = {uid: 1};
        let item  = {
            uid : 2,
            item: item1
        };
        one.put(item); //1
        let item3 = {
            uid : 3,
            item: item1
        };
        one.put(item3); //2
        one.evict(item);//3
        expect(one.length()).to.equal(3);
        expect(one.size()).to.equal(2); // item1, item3
        expect(one.contains(item1)).to.be.true;
        expect(one.contains(item3)).to.be.true;

        one.evict(1);

        expect(one.length()).to.equal(4);
        expect(one.size()).to.equal(1);
        expect(one.contains(item3)).to.be.true;
        expect(one.contains(item1)).to.be.false;

        let result = one.get(3);
        expect(result.item).to.be.undefined;
    });

    it("removes with pointers inside array", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2, items: [item1]};
        let item3 = {uid: 3};
        one.put(item2);
        one.put(item3);
        one.evict(item2);
        expect(one.length()).to.equal(3);
        expect(one.size()).to.equal(1);
    });

    it("removes with pointers deeply nested inside objects", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2, item: {nested: item1}};
        one.put(item2);
        one.evict(item2);
        expect(one.length()).to.equal(2);
        expect(one.size()).to.equal(0);
    });

    it("updates multiple pointer references", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid : 2,
            item: item1
        };
        let item3 = {
            uid  : 3,
            items: [item1]
        };
        one.put([item2, item3, item3]);

        item1 = one.getEdit(item1);
        expect(Object.isFrozen(item1)).to.be.false;
        let item4  = {
            uid: 4
        };
        item1.item = item4;
        expect(item1.item).to.not.be.undefined;
        one.put(item1);

        // check updates to the parent enitities
        let result2 = one.get(2);
        expect(result2.item.item.uid).to.equal(4);
        let result3 = one.get(3);
        expect(result3.items[0].item.uid).to.equal(4);

        item4      = one.getEdit(4);
        item4.text = "standard";
        one.put(item4);

        result2 = one.get(2);
        result3 = one.get(3);
        expect(result2.item.item.text).to.equal("standard");
        expect(result3.items[0].item.text).to.equal("standard");
        let result1 = one.get(1);
        expect(result1.item.text).to.equal("standard");
    })
});


