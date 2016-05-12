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

describe("References", function () {

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

    it("updates pointers correctly when putting via an entity reference", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid : 2,
            item: item1
        };
        One.put([item2]);
        item1      = One.getEdit(1);
        item1.text = "test";
        One.put(item1);
        expect(One.size()).to.equal(2);
        expect(One.length()).to.equal(2);
        let result = One.get(2);
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
        One.put(item3);
        let cached2 = One.get(2);
        let cached3 = One.get(3);
        item1       = One.getEdit(1);
        item1.text  = "test";
        One.put(item1);
        let result2 = One.get(2);
        expect(cached2 === result2).to.be.false;
        expect(result2.item.text).to.equal("test");
        let result3 = One.get(3);
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
        One.put(item2);
        item1      = One.getEdit(1);
        item1.text = "test";
        One.put(item1);

        let result2 = One.get(item2);

        expect(result2 === item2).to.be.false;
        expect(result2.item === item2.item).to.be.false;
        expect(result2.item.item.text).to.equal("test");

        // compare to the previous instance of item1
        One.undo();
        let result1 = One.get(1);
        expect(result2.item.item === result1).to.be.false;
    });

    it("updates pointers when nested inside arrays", function () {
        let item1 = {uid: 1};
        let item2 = {
            uid  : 2,
            items: [item1]
        }
        One.put(item2);
        item1      = One.getEdit(1);
        item1.text = "test";
        One.put(item1);

        ;

        let result2 = One.get(2);
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
        One.put(item2);
        item1      = One.getEdit(item1);
        item1.text = "test";
        One.put(item1);
        ;
        let result = One.get(2);
        expect(result.items[0][0].text).to.equal("test");
        One.undo();
        let result1 = One.get(1);
        expect(result.items[0][0] === result1).to.be.false;
    });

    it("keeps previous version pointers when it updates the new ones", function () {
        let item1 = {uid: 1};
        One.put(item1);
        let item = {
            uid : 2,
            item: item1
        };
        One.put(item);
        let resultOne = One.get(1);
        // rewind one and check again
        One.undo();
        expect(One.contains(2)).to.be.false;
        let resultTwo = One.get(1);
        expect(resultOne === resultTwo).to.be.true;
    });

    it("leaves previous pointer set intact when entity is evicted on current state", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2, item: item1};
        One.put(item2);

        let item3 = {uid: 3, item: item1};
        One.put(item3);

        One.evict(1);
        expect(One.length()).to.equal(3);
        expect(One.size()).to.equal(2);
        expect(One.get(1)).to.be.undefined;
        expect(One.get(2)).to.not.be.undefined;
        expect(One.get(3)).to.not.be.undefined;

        One.undo();
        expect(One.get(1)).to.not.be.undefined;

        // verify pointers
        One.evict(item2);
        expect(One.length()).to.equal(3);
        expect(One.size()).to.equal(2);
        expect(One.get(1)).to.not.be.undefined;
        expect(One.get(2)).to.be.undefined;
        expect(One.get(3)).to.not.be.undefined;

        One.evict(item3);
        expect(One.length()).to.equal(4);
        expect(One.size()).to.equal(0);
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
        One.put(item2);

        let editable2       = One.getEdit(2);
        editable2.otherItem = {
            uid: 1,
            val: "two"
        };
        One.put(editable2);

        let result = One.get(item2);
        expect(result.item.val).to.equal("two");
        expect(result.items[0].val).to.equal("two");
    });

    it("updates pointers array when putting through another entity", function () {
        let item1 = {uid: 1};
        let item  = {
            uid : 2,
            item: item1
        };
        One.put(item); //1
        let item3 = {
            uid : 3,
            item: item1
        };
        One.put(item3); //2
        One.evict(item);//3
        expect(One.length()).to.equal(3);
        expect(One.size()).to.equal(2); // item1, item3
        expect(One.contains(item1)).to.be.true;
        expect(One.contains(item3)).to.be.true;

        One.evict(1);

        expect(One.length()).to.equal(4);
        expect(One.size()).to.equal(1);
        expect(One.contains(item3)).to.be.true;
        expect(One.contains(item1)).to.be.false;

        let result = One.get(3);
        expect(result.item).to.be.undefined;
    });

    it("removes with pointers inside array", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2, items: [item1]};
        let item3 = {uid: 3};
        One.put(item2);
        One.put(item3);
        One.evict(item2);
        expect(One.length()).to.equal(3);
        expect(One.size()).to.equal(1);
    });

    it("removes with pointers deeply nested inside objects", function () {
        let item1 = {uid: 1};
        let item2 = {uid: 2, item: {nested: item1}};
        One.put(item2);
        One.evict(item2);
        expect(One.length()).to.equal(2);
        expect(One.size()).to.equal(0);
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
        One.put([item2, item3, item3]);

        item1 = One.getEdit(item1);
        expect(Object.isFrozen(item1)).to.be.false;
        let item4  = {
            uid: 4
        };
        item1.item = item4;
        expect(item1.item).to.not.be.undefined;
        One.put(item1);

        // check updates to the parent enitities
        let result2 = One.get(2);
        expect(result2.item.item.uid).to.equal(4);
        let result3 = One.get(3);
        expect(result3.items[0].item.uid).to.equal(4);

        item4      = One.getEdit(4);
        item4.text = "standard";
        One.put(item4);

        result2 = One.get(2);
        result3 = One.get(3);
        expect(result2.item.item.text).to.equal("standard");
        expect(result3.items[0].item.text).to.equal("standard");
        let result1 = One.get(1);
        expect(result1.item.text).to.equal("standard");
    })
});


