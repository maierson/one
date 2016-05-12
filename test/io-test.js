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

describe("IO", function () {

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
        // path = null;
    });

    describe("put / get", function () {

        it("finds cache-uid", function () {
            expect(One).to.not.be.undefined;
        });

        it("initializes with no map", function () {
            expect(One).to.not.be.null;
            expect(One.size()).to.equal(0);
            expect(One.length()).to.equal(0);
        });

        it("puts frozen object", function () {
            let item1 = {uid: 1};
            let item2 = {uid: "2", item: item1, otherItem: undefined};
            One.put(item2);

            expect(One.size()).to.equal(2);
            expect(One.length()).to.equal(1);

            let result2 = One.get(2);
            expect(result2.uid).to.equal("2");
            expect(result2.item.uid).to.equal(1);

            expect(Object.isFrozen(result2)).to.be.true;

            // also can retrieve 1 separately
            let result1 = One.get(1);
            expect(result1).to.not.be.undefined;
            expect(result1.uid).to.equal(1);
            expect(Object.isFrozen(result1)).to.be.true;
        });

        it("puts simple array correctly", function () {
            let item = {uid: 1, items: ["one", "two", "three"]};
            One.put(item);
            let result = One.getEdit(1);
            result.items.push("four");
            result.items.push("five");
            One.put(result);
            expect(One.get(1).items.length).to.equal(5);
            expect(One.get(1).items[3]).to.equal("four");
            expect(One.get(1).items[4]).to.equal("five");
        });

        it("freezes entity deeply", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            let item3 = {
                uid : 3,
                item: item2
            };
            One.put(item3);
            let result = One.get(3);
            expect(Object.isFrozen(result)).to.be.true;
            expect(Object.isFrozen(result.item)).to.be.true;
            expect(Object.isFrozen(result.item.item)).to.be.true;
            expect(Object.isFrozen(item3)).to.be.true;
            expect(item3 === result).to.be.true;
        });

        it("puts / gets even if top entity has no uid", function () {
            let item1 = {uid: 1};
            let item  = {
                val : "test",
                item: item1
            };
            One.put(item);
            let result = One.get(1);
            expect(result).to.not.be.undefined;
            expect(() => {
                result.test = "something";
            }).to.throw(TypeError);
        });

        it("does not put the entity if not changed", function () {
            let item1 = {uid: 1};
            let state = One.put(item1);
            expect(state.success).to.be.true;
            state = One.put(item1);
            expect(state.success).to.be.false;
        });

        it("puts array from top entity that has no uid", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, items: [item1]};
            let item  = {
                val  : "test",
                items: [item2]
            };
            One.put(item);
            expect(One.get(1)).to.not.be.undefined;
            expect(One.get(2)).to.not.be.undefined;
            expect(One.size()).to.equal(2);
            expect(One.length()).to.equal(1);
        });

        it("updates parent when inner uid ref changed but keeps other children references unchanged", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {
                uid  : 3,
                item1: item1,
                item2: item2
            };
            One.put(item3);

            let item4 = {uid:4};
            One.put(item4);
            let edit1  = One.getEdit(1);
            edit1.item = item4;
            One.put(edit1);

            let result = One.get(3);
            expect(item2 === result.item2).to.be.true;
            let result2 = One.get(2);
            expect(item2 === result2).to.be.true;
        });


        it("updates parent when inner uid ref changed " +
            "but keeps other children references unchanged in ARRAY", function () {
            let item = {uid:"item"};
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {
                uid  : 3,
                item : item,
                children: [item1,item2]
            };
            One.put(item3);

            let item4 = {uid:4};
            One.put(item4);
            let edit1  = One.getEdit(1);
            edit1.item = item4;
            One.put(edit1);

            let itemResult = One.get("item");
            expect(item === itemResult).to.be.true;
            let result = One.get(3);
            expect(item2 === result.children[1]).to.be.true;
            let result2 = One.get(2);
            expect(item2 === result2).to.be.true;
        });

        it("puts top array even if it contains no uid items", function () {
            let firstItem = {uid: "first"};
            let item1     = {uid: 1, item: firstItem};
            let item2     = {uid: 2};
            let item3     = {uid: 3};
            let item4     = {
                uid  : 4,
                value: "four",
                items: [
                    item3
                ]
            };
            let item      = {
                value: "test",
                items: [
                    item1, item2
                ]
            };
            let arr       = [item1, item2, item4, item];
            One.put(arr);
            expect(One.get(1)).to.not.be.undefined;
            expect(One.get(firstItem)).to.not.be.undefined;
            expect(One.get(2)).to.not.be.undefined;
            expect(One.get(4)).to.not.be.undefined;
            expect(One.get(3)).to.not.be.undefined;
            expect(One.length()).to.equal(1);
            expect(One.size()).to.equal(5);
        });

        it("puts array of items", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {uid: 3, item: item2};
            One.put([item1, item3]);
            expect(One.size()).to.equal(3);
            expect(One.length()).to.equal(1);
            expect(One.get(1)).to.not.be.undefined;
            expect(One.get(2)).to.not.be.undefined;
            expect(One.get(3)).to.not.be.undefined;
        });

        it("gets array of items in requested order", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {uid: 3, item: item2};
            One.put([item1, item3]);
            let result = One.get([1, 3, item2]);
            expect(isArray(result)).to.be.true;
            expect(result[0].uid).to.equal(1);
            expect(result[1].uid).to.equal(3);
            expect(result[2].uid).to.equal(2);
            // aslo check identity
            expect(item2 === result[1].item).to.be.true;
        });

        it("gets undefined for non existing cached item", function () {
            expect(One.get(1)).to.be.undefined;
            expect(One.getEdit(1)).to.be.undefined;
            expect(One.get({uid: 1})).to.be.undefined;
        });

        it("gets editable entity that is a clone of the cached entity", function () {
            let item1 = {uid: 1};
            One.put(item1);
            let result     = One.get(1);
            let resultEdit = One.getEdit(1);
            expect(resultEdit).to.not.be.undefined;
            expect(result === resultEdit).to.be.false;
            expect(result.uid).to.equal(1);
            resultEdit.test = "something";
            expect(resultEdit.test).to.equal("something");
            expect(result.test).to.be.undefined;
        });

        it("gets editable array of clones", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {uid: 3, item: item2};
            One.put([item1, item3]);
            let result = One.getEdit([1, 3, item2]);

            expect(isArray(result)).to.be.true;
            expect(result[0].uid).to.equal(1);
            expect(result[1].uid).to.equal(3);
            expect(result[2].uid).to.equal(2);
            // aslo check identity
            expect(item2 === result[1].item).to.be.true;
            expect(result[2] === result[1].item).to.be.false;
        });

        it("maintains deep objects without uid editable when getting editable", function () {
            let firstObj  = {text: "test"};
            let secondObj = {text: "new"};
            let item2     = {uid: 2};
            let item3     = {uid: 3};
            let item      = {
                uid     : 1,
                item    : firstObj,
                item3   : item3,
                children: [
                    "something",
                    secondObj,
                    item2
                ]
            };
            One.put(item);

            // check object reference to be frozen and identical to original
            let result = One.get(1);
            expect(Object.isFrozen(result.item)).to.be.true;
            expect(firstObj === result.item).to.be.true;

            expect(Object.isFrozen(result.children)).to.be.true;
            expect(result.children[1] === secondObj).to.be.true;
            expect(result === item).to.be.true;
            expect(Object.isFrozen(result.item3)).to.be.true;
            expect(result.item3 === item3).to.be.true;
            expect(Object.isFrozen(result.children[2])).to.be.true;
            expect(result.children[2] === item2).to.be.true;

            // check object reference to be frozen and identical to original after editable
            let editableResult = One.getEdit(1);
            // non uid items come out editable
            expect(Object.isFrozen(editableResult.item)).to.be.false;
            // non uid items are replaced and made editable
            expect(firstObj === editableResult.item).to.be.false;
            // arrays are made editable
            expect(Object.isFrozen(editableResult.children)).to.be.false;
            // their non uid items are replaced and made editable
            expect(editableResult.children[1] === secondObj).to.be.false;
            // maintain uid reference as is
            expect(Object.isFrozen(result.item3)).to.be.true;
            expect(result.item3 === item3).to.be.true;
            // maintain all uid items (even nested in array) as is
            expect(Object.isFrozen(result.children[2])).to.be.true;
            expect(result.children[2] === item2).to.be.true;
            // new editable parent
            expect(editableResult === item).to.be.false;
        });

        it("maintins deep objects with uid identical when getting editable", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            One.put(item2);
            let result = One.get(2);
            expect(result.item === item1).to.be.true;

            result = One.getEdit(2);
            expect(result.item === item1).to.be.true;
            expect(Object.isFrozen(result.item)).to.be.true;
        });

        it("maintains deep objects whithin array identical when getting editable", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {
                uid: 3, items: [
                    item1, item2
                ]
            };
            One.put(item3);
            let result = One.getEdit(3);
            expect(result.items[0] === item1).to.be.true;
            expect(Object.isFrozen(result.items[0])).to.be.true;
            expect(result.items[1] === item2).to.be.true;
            expect(Object.isFrozen(result.items[1])).to.be.true;
        });

        it("throws error if getting without an item or uid", function () {
            expect(() => {
                One.get();
            }).to.throw(TypeError);
        });

        it("detects shallow dirty entity", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            One.put(item1);
            expect(One.isDirty(item1)).to.be.false;
            expect(One.isDirty(item2)).to.be.true;
            expect(One.isDirty(One.get(1))).to.be.false;
            expect(One.isDirty(One.getEdit(1))).to.be.true;
        });

        // this goes one back, removes all the items after the current state
        // and adds a new state with the appropriate changes
        it("puts and updates entity correctly after undo", function () {
            let item1 = {uid: 1};
            One.put(item1);
            let item2 = {uid: 2, item: item1};
            One.put(item2);

            let state = One.undo();
            expect(state.success).to.be.true;
            expect(state.hasPrev).to.be.false;
            expect(state.hasNext).to.be.true;

            item1      = One.getEdit(1);
            item1.text = "text";
            state      = One.put(item1);
            expect(One.get(1).text).to.equal("text");
        });

        it("replaces existing props on existing entity when putting new entity that does not have them", function () {
            let item = {
                uid     : 1,
                test    : "test",
                children: [
                    "one", "two"
                ]
            };
            One.put(item);
            item = {
                uid     : 1,
                some    : "some",
                children: [
                    "three", "one"
                ]
            };
            // put weak = does not replace inner uid items but does replace others
            One.put(item);

            let result = One.get(1);
            expect(result.test).to.be.undefined;
            expect(result.some).to.equal("some");
            let hasOne = result.children.some(item => {
                return item === "one";
            });
            expect(hasOne).to.be.true;
            let hasThree = result.children.some(item => {
                return item === "three";
            });
            expect(hasThree).to.be.true;
        });

        it("puts array of entities in one cache update", function () {
            let arr = [{uid: 1}, {uid: 2}, {uid: 3}];
            One.put(arr);
            expect(One.length()).to.equal(1);
            expect(One.size()).to.equal(3);
            expect(One.get(1)).to.not.be.undefined;
            expect(One.get(2)).to.not.be.undefined;
            expect(One.get(3)).to.not.be.undefined;
        });

        it("puts a complex tree of objects contained in an array", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            let item3 = {
                uid     : 3,
                item    : item2,
                children: [item1]
            };
            let arr   = [item1, item2, item3];
            One.put(arr);
            expect(One.length()).to.equal(1);
            expect(One.size()).to.equal(3);
            expect(One.get(1)).to.not.be.undefined;
            let res2 = One.get(2);
            expect(res2).to.not.be.undefined;
            expect(res2.item.uid).to.equal(1);
            let res3 = One.get(3);
            expect(res3).to.not.be.undefined;
            expect(res3.children[0].uid).to.equal(1);
        });

        it("does not add to cache if no uid", function () {
            let existing = {uid: ""};
            One.put(existing);
            expect(One.size()).to.equal(0);
            expect(One.length()).to.equal(0);
        });

        it("adds new item to the cache", function () {
            let item = {uid: 1, value: "one"};
            One.put(item);
            expect(One.size()).to.equal(1);
            expect(One.length()).to.equal(1);
        });

        it("adds inner array objects to the cache", function () {
            let item = {
                uid     : 1,
                relative: {uid: 4, value: "four"},
                children: [
                    {uid: 2, value: "two"},
                    {uid: 3, value: "three"}
                ]
            };
            One.put(item);

            // all items with uid are added to the cache
            expect(One.size()).to.equal(4);
            expect(One.get(1)).to.not.be.undefined;

            let item2 = One.get(2);
            expect(item2).to.not.be.undefined;
            expect(item2.value).to.equal("two");

            let item3 = One.get(3);
            expect(item3).to.not.be.undefined;
            expect(item3.value).to.equal("three");

            let item4 = One.get(4);
            expect(item4).to.not.be.undefined;
            expect(item4.value).to.equal("four");

            // only one extra cache state is added
            expect(One.length()).to.equal(1);
            // with undo we are at the beginning of the nodes array
            One.put({uid: 100});
            let state = One.undo();

            expect(state.success).to.be.true;
            expect(state.index).to.equal(0);

            // also going forward also puts us at the other end
            state = One.redo();
            // since we're already on the last redo (undo didn't move it as it doesn't read the first item in the nodes)
            expect(state.success).to.be.true;
            expect(state.hasNext).to.be.false;
        });

        it("updates all pointing parents when putting nested entity", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {
                uid      : 3,
                item     : item2,
                otherItem: {
                    nested: item1
                }
            };
            One.put(item3);
            expect(One.length()).to.equal(1);
            expect(One.size()).to.equal(3);

            // at this point item1 is frozen. To continue editing must get a copy
            item1 = One.getEdit(1);
            // change item 1 and make sure it modified in item2 on current state but not previous
            item1.text = "text";
            One.put(item1);
            let result = One.get(3);
            expect(result.otherItem.nested.text).to.equal("text");
            One.undo();
            result = One.get(3);
            expect(result.otherItem.nested.text).to.be.undefined;
        });

        it("updates all pointing parents when putting and entity updated deeply inside another", function () {
            let item1 = {uid: 1, val: "one"};
            let item2 = {
                uid : 2,
                item: item1
            };
            One.put(item2);
            let otherItem1 = {
                uid: 1,
                val: "two"
            };
            let item3      = {
                uid  : 3,
                other: otherItem1
            };
            One.put(item3);
            let result = One.get(2);
            expect(result.item.val).to.equal("two");
        });

        it("updates all pointing parents when putting and entity updated deeply inside another's array", function () {
            let item1 = {uid: 1, val: "one"};
            let item2 = {
                uid : 2,
                item: item1
            };
            One.put(item2);
            let otherItem1 = {
                uid: 1,
                val: "two"
            };
            let item3      = {
                uid   : 3,
                others: [otherItem1]
            };
            One.put(item3);
            let result = One.get(2);
            expect(result.item.val).to.equal("two");
        });

        it("adds deep inner nested objects to the cache", function () {
            let item1 = {uid: 1};
            let item2 = {
                uid : 2,
                item: {
                    nested: {
                        deep: item1
                    }
                }
            };
            One.put(item2);
            expect(One.length()).to.equal(1);
            expect(One.size()).to.equal(2);

            // change item 1 and make sure it modified in item2 on current state but not previous
            item1      = One.getEdit(item1);
            item1.text = "text";
            One.put(item1);
            let result = One.get(2);
            expect(result.item.nested.deep.text).to.equal("text");
            One.undo();
            result = One.get(2);
            expect(result.item.nested.deep.text).to.be.undefined;
        });

        it("adds inner nested objects in array to the cache", function () {
            let item1 = {uid: 1};
            let item2 = {
                uid : 2,
                item: {
                    nested: [item1]
                }
            };
            One.put(item2);
            expect(One.length()).to.equal(1);
            expect(One.size()).to.equal(2);

            // change item 1 and make sure it modified in item2 on current state but not previous
            item1      = One.getEdit(item1);
            item1.text = "text";

            One.put(item1);

            let result = One.get(2);

            expect(result.item.nested[0].text).to.equal("text");
            One.undo();
            result = One.get(2);
            expect(result.item.nested[0].text).to.be.undefined;
        });

        it("replaces references with uid placeholders", function () {
            let item = {
                uid     : 1,
                relative: {uid: 4, value: "four"},
                children: [
                    {
                        uid     : 2,
                        value   : "two",
                        children: [
                            {uid: 5, value: "five"},
                            {uid: 6, value: "six"}
                        ]
                    },
                    {
                        uid: 3, value: "three"
                    }
                ]
            };
            One.put(item);

            // check state
            expect(One.size()).to.equal(6);
            expect(One.length()).to.equal(1);

            // check items
            const result1 = One.get(1);
            expect(result1.children.length).to.equal(2);
            expect(result1.children[0].uid).to.equal(2);
            expect(result1.children[1].uid).to.equal(3);
            const result2 = One.get(2);
            expect(result2.children.length).to.equal(2);
            expect(result2.children[0].uid).to.equal(5);
            expect(result2.children[1].uid).to.equal(6);
        });

        it("keeps non uid references as is", function () {
            let item1 = {uid: 1, value: "one"};
            let item3 = {uid: 3, value: "three"};
            let item2 = {
                uid     : 2,
                ref     : item1,
                value   : {val: "one"},
                value2  : "two",
                children: [
                    item3,
                    {value: "test"}
                ]
            };
            One.put(item2);
            const result = One.get(2);
            expect(result.value.val).to.equal("one");
            expect(result.value2).to.equal("two");
            expect(result.children[1].value).to.equal("test");
        });

        it("adds deeply nested array objects to the cache", function () {
            let item = {
                uid     : 1,
                children: [
                    [
                        {uid: 2, value: "two"},
                        {
                            uid: 3, children: [
                            {uid: 4, value: "four"}
                        ]
                        }
                    ]
                ]
            };
            One.put(item);

            expect(One.size()).to.equal(4);

            let item1 = One.get(1);
            expect(item1).to.not.be.undefined;
            expect(item1.children).to.be.an("array");
            expect(item1.children.length).to.equal(1);

            let child1 = item1.children[0];
            expect(child1).to.be.an("array");
            expect(child1.length).to.equal(2);

            let item2 = One.get(2);
            expect(item2).to.not.be.undefined;
            expect(item2.value).to.equal("two");

            let item3 = One.get(3);
            expect(item3).to.not.be.undefined;
            expect(item3.children).to.be.an("Array");
            expect(item3.children.length).to.equal(1);

            let item4 = One.get(4);
            expect(item4).to.not.be.undefined;
            expect(item4.value).to.equal("four");

            expect(One.length()).to.equal(1);
        });

        it("freezes previous versions of the nodes", function () {
            let item1 = {
                uid     : 1,
                children: [
                    {uid: 2}
                ]
            };
            One.put(item1);
            let result = One.getCurrentNode();
            expect(result).to.not.be.undefined;
            expect(One.size()).to.equal(2);
            try {
                result.items.delete(1);
            } catch (err) {
                console.log("ERROR remove from cache:" + err.message);
            }
            expect(One.size()).to.equal(2);
        });

        it("does not alter the original when putting new", function () {
            let item2 = {uid: 2};
            let item3 = {uid: 3};
            let item4 = {uid: 4};

            let original = {
                uid     : 1,
                ref     : item2,
                children: [
                    item3, item4
                ]
            };
            One.put(original);

            expect(original.ref).to.equal(item2);
            expect(original.children[0]).to.equal(item3);
            expect(original.children[1]).to.equal(item4);
        });

        it("updates array when changed", function () {
            let item2 = {uid: 2};
            let item3 = {uid: 3};
            let item4 = {uid: 4};
            let item  = {
                uid     : 1,
                ref     : item2,
                children: [
                    item3
                ]
            };
            One.put(item);

            let editableItem = One.getEdit(1);
            editableItem.children.pop();
            editableItem.children.push(item4);

            One.put(editableItem);

            let result = One.get(1);
            expect(result.children[0].uid).to.equal(4);
            expect(One.refFrom(4)["1"][0]).to.equal("children.0");
            expect(One.refTo(1)["3"]).to.be.undefined;
            expect(One.refTo(1)["4"][0]).to.equal("children.0");
        });

        it("does not put if there are no changes to the item", function () {
            let item2 = {uid: 2};
            let item3 = {uid: 3};
            let item4 = {uid: 4};
            let item  = {
                uid     : 1,
                ref     : item2,
                children: [
                    item3, item4
                ]
            };
            One.put(item);
            expect(One.length()).to.equal(1);
            expect(Object.isFrozen(item), "Cached item is not frozen").to.be.true;
            expect(item === One.get(1), "Cached item is not identical to passed in item").to.be.true;
            One.put(item);
            expect(One.length()).to.equal(1);
        });

        it("maintains single reference to object retrieved in multiple places in deep structure", function () {
            let item1 = {uid: 1, value: "one"};
            let item2 = {
                uid     : 2,
                child   : item1,
                children: [
                    item1,
                    {value: "test"}
                ]
            };

            One.put(item2);

            let otherItem1 = {
                uid  : 1,
                value: "two"
            };

            let item3 = {
                uid      : 3,
                item     : item1,
                otherItem: otherItem1
            };
            One.put(item3);

            let result = One.get(2);

            expect(result.child.uid).to.equal(1);
            expect(result.children[0].uid).to.equal(1);
            expect(result.child === result.children[0]).to.be.true;

            let result3 = One.get(3);
            expect(result.child === result3.item).to.be.true;
            expect(result3.item === result3.otherItem).to.be.true;

            expect(result.child === result3.otherItem).to.be.true;

            // but the value was updated globally
            expect(result.child.value).to.equal("two");
        });

        it("preserves properties with null values", function () {
            let item1 = {uid: 1, value: "one"};
            let item2 = {
                uid     : 2,
                child   : null,
                children: [
                    item1,
                    {value: "test"}
                ]
            };
            One.put(item2);
            let result = One.get(2);
            expect(result.child).to.equal(null);
        });

        it("returns item if primitive", function () {
            expect(One.put(1).success).to.be.false;
        });

        it("returns proper boolean when putting item", function () {
            let item2 = {uid: 2};
            let item3 = {uid: 3};
            let item4 = {uid: 4};
            let item  = {
                uid     : 1,
                value   : "test",
                ref     : item2,
                children: [
                    item3, item4
                ]
            };
            expect(One.put(item).success).to.be.true;
            expect(One.put(item).success).to.be.false;
        });
    });

    describe("get", function () {
        it("gets an entire array by uid", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {uid: 3};
            let item4 = {uid: 4, items: [item1, item2]};
            One.put([item1, item2, item3, item4]);
            let result = One.get([1, 2, 4]);
            expect(isArray(result)).to.be.true;
            expect(result.length).to.equal(3);
            expect(result[0].uid).to.equal(1);
            expect(result[1].uid).to.equal(2);
            expect(result[2].uid).to.equal(4);
            expect(result[2].items[0].uid).to.equal(1);
            expect(result[2].items[1].uid).to.equal(2);
        });

        it("gets an entire array by entities", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {uid: 3};
            let item4 = {uid: 4, items: [item1, item2]};
            One.put([item1, item2, item3, item4]);
            let result = One.get([item1, item2, item4]);
            expect(isArray(result)).to.be.true;
            expect(result.length).to.equal(3);
            expect(result[0].uid).to.equal(1);
            expect(result[1].uid).to.equal(2);
            expect(result[2].uid).to.equal(4);
            expect(result[2].items[0].uid).to.equal(1);
            expect(result[2].items[1].uid).to.equal(2);
        });

        it("gets an array mixed by entity or uid", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {uid: 3};
            let item4 = {uid: 4, items: [item1, item2]};
            One.put([item1, item2, item3, item4]);
            let result = One.get([1, item2, 4]);
            expect(isArray(result)).to.be.true;
            expect(result.length).to.equal(3);
            expect(result[0].uid).to.equal(1);
            expect(result[1].uid).to.equal(2);
            expect(result[2].uid).to.equal(4);
            expect(result[2].items[0].uid).to.equal(1);
            expect(result[2].items[1].uid).to.equal(2);
        });

        it("gets an entire array but skips non uid array entities", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item  = {val: "test"};
            One.put([item1, item2, item]);
            let result = One.get([1, 2, item]);
            expect(isArray(result)).to.be.true;
            expect(result.length).to.equal(2);
            expect(result[0].uid).to.equal(1);
            expect(result[1].uid).to.equal(2);
        });

    });

    describe("evict", function () {

        it("returns false if nothing evicted", function () {
            expect(One.evict({})).to.be.false;
            expect(One.evict()).to.be.false;
            expect(One.evict(true)).to.be.false;
        });

        it("fails on non existing uid", function () {
            expect(One.evict(["one", 1])).to.be.false;
        })

        it("removes item from cache when evicting", function () {
            let item1 = {uid: 1, value: "test"};
            One.put(item1);
            One.evict(item1);

            expect(One.size()).to.equal(0);
            expect(One.length()).to.equal(2);
        });

        it("evicts non-referenced items when parent is evicted", function () {
            let item1  = {uid: 1};
            let parent = {
                uid : 2,
                item: item1
            };
            One.put(parent);
            One.evict(parent);
            expect(One.length()).to.equal(2);
            expect(One.size()).to.equal(0);
        });

        it("doesn't evict referenced items when parent is evicted", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            let item3 = {uid: 3, item: item1};
            One.put(item2);
            One.put(item3);
            One.evict(item3);

            expect(One.length()).to.equal(3);
            expect(One.size()).to.equal(2);

            expect(One.get(1)).to.not.be.undefined;
            expect(One.refFrom(1)["2"].length).to.equal(1);
            expect(One.refFrom(1)["2"][0]).to.equal("item");
            expect(One.refFrom(1)["3"]).to.be.undefined;

            One.evict(item2);
            expect(One.length()).to.equal(4);
            expect(One.size()).to.equal(0);
            expect(One.get(1)).to.be.undefined;
        });

        it("clears references from an item that was removed from a parent being put", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, val: item1};
            One.put(item2);

            let editable = One.getEdit(2);
            editable.val = undefined;
            One.put(editable);

            expect(One.get(1)).to.be.undefined;
            expect(One.refTo(2)["1"]).to.be.undefined;
        });

        it("evicts an array with all its references", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            let item3 = {
                uid     : 3,
                item    : item2,
                children: [item1]
            };
            let arr   = [item1, item2, item3];
            One.put(arr);
            One.evict(arr);
            expect(One.size()).to.equal(0);
            expect(One.length()).to.equal(2);
        });

        it("evicts only the referenced items when evicting an array", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            let item3 = {
                uid     : 3,
                item    : item2,
                children: [item1]
            };
            let item4 = {
                uid : 4,
                item: item1
            };
            let arr   = [item1, item2, item3, item4];
            One.put(arr);
            One.evict([item2, item3]);
            expect(One.size()).to.equal(2);
            expect(One.length()).to.equal(2);
            expect(One.get(1)).to.not.be.undefined;
            expect(One.get(4)).to.not.be.undefined;
            expect(One.get(2)).to.be.undefined;
            expect(One.get(3)).to.be.undefined;
        });

        it("removes references from left over pointing items when evicting an entity", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            let item3 = {uid: 3, item: item1};
            One.put([item2, item3]);
            One.evict(item1);
            expect(One.refTo(2)["1"]).to.be.undefined;
            expect(One.refTo(3)["1"]).to.be.undefined;
        });

        it("removes entity array referenced when deleting array from parent", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, children: [item1]};
            One.put(item2);

            let editable      = One.getEdit(2);
            editable.children = undefined;
            One.put(editable);

            expect(One.refTo(2)["1"]).to.be.undefined;
            expect(One.get(1)).to.be.undefined;
        });

        it("removes entity array referenced when removed from array", function () {
            let item1 = {uid: 1};
            let item2 = {
                uid  : 2,
                item : item1,
                items: [item1]
            };
            One.put(item2); // 0

            let editable = One.getEdit(2);
            delete editable.item;
            One.put(editable);

            expect(One.refFrom(1)["2"].length).to.equal(1);

            editable       = One.getEdit(2);
            editable.items = undefined;
            One.put(editable);

            expect(One.get(1)).to.be.undefined;
            expect(One.refTo(2)["1"]).to.be.undefined;
        });

        it("removes entity if is last reference when putting entity with removed reference", function () {
            let item1 = {uid: 1};
            let item3 = {
                uid : 3,
                item: item1
            };
            let item4 = {uid: 4};
            let item2 = {
                uid  : 2,
                item : item1,
                other: item3,
                items: [item1, item3, item4]
            };
            One.put(item2); // 0

            expect(One.size()).to.equal(4);

            let editable = One.getEdit(2);
            delete editable.item;
            editable.items = [];

            One.put(editable); // 1

            let result = One.get(1);
            expect(result).to.not.be.undefined;

            editable = One.getEdit(3);
            delete editable.item;
            One.put(editable);

            result = One.get(1);
            expect(One.get(3)).to.not.be.undefined;
            expect(result).to.be.undefined;
        });

        it("builds the prop chain correctly for objects", function () {
            let item  = {uid: 1};
            let item2 = {
                uid     : 2,
                rootItem: item,
                ref     : {
                    inner: {
                        item: item
                    }
                }
            };

            One.put(item2);
            let result = One.get(2);

            let refFrom = One.refFrom(1);
            expect(refFrom["2"]).to.not.be.undefined;
            expect(isArray(refFrom["2"])).to.be.true;
            expect(refFrom["2"][0]).to.equal("rootItem");
            expect(refFrom["2"][1]).to.equal("ref.inner.item");

            let refTo = One.refTo(2);
            expect(refTo["1"]).to.not.be.undefined;
            expect(isArray(refTo["1"])).to.be.true;
            expect(refTo["1"][0]).to.equal("rootItem");
            expect(refTo["1"][1]).to.equal("ref.inner.item");
        });

        it("doesn't reference entity inside another entity", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            let item3 = {
                uid : 3,
                item: item2
            };
            One.put(item3);

            let refTo = One.refTo(3);
            expect(refTo["1"]).to.be.undefined;
        });

        it("builds the prop chain correctly for array", function () {
            let item  = {uid: 1};
            let item2 = {
                uid  : 2,
                items: [item]
            };
            One.put(item2);
            expect(One.refTo(2)["1"][0]).to.equal("items.0");
            expect(One.refFrom(1)["2"][0]).to.equal("items.0");
        });

        it("builds the prop chain correctly for nested array", function () {
            let item  = {uid: 1};
            let item2 = {
                uid  : 2,
                items: [item, [item]]
            };
            //TODO maybe keep track of number of refs inside an array to know how deep to search (might be overkill and
            // better to just iterate the array to the end when removing references
            One.put(item2);
            expect(One.refTo(2)["1"][0]).to.equal("items.0");
            expect(One.refFrom(1)["2"][0]).to.equal("items.0");
        });

        it("removes references within array when deleting item from cache", function () {
            let item1  = {uid: 1};
            let item1a = {uid: "1a"};
            let item3  = {uid: 3, item: item1, item2: item1a};
            let item2  = {uid: 2, items: [item1, item3]};
            One.put([item2, item3]);

            items = One.get(2).items;
            expect(items.length).to.equal(2);

            One.evict(3);

            expect(One.get("1a")).to.be.undefined;
            let items = One.get(2).items;
            expect(items.length).to.equal(1);
            expect(items[0].uid).to.equal(1);

            // make sure it didn't alter the previous node
            One.undo();
            items = One.get(2).items;
            expect(items.length).to.equal(2);
        });

        it("creates new entity when updating through a referenced entity", function () {
            let item1 = {uid: 1};
            One.put(item1);
            let item2 = {uid: 2, item: {uid: 1, test: "test"}};
            One.put(item2);
            let result = One.get(1);
            expect(result.test).to.equal("test");
            One.undo();
            result = One.get(1);
            expect(result.test).to.be.undefined;
        });

        it("removes all subsequent states when undo-ing and modifying a state", function () {
            "use strict";
            let item1 = {uid: 1};
            One.put(item1);
            let item2 = {uid: 2};
            One.put(item2);
            let state = One.undo();
            expect(state.hasNext).to.be.true;
            state = One.put({uid: 1, text: "text"});
            expect(state.hasNext).to.be.false;
            let result = One.get(1);
            expect(result.text).to.equal("text");
        });

        it("removes subsequent states when evicting", function () {
            let item1 = {uid: 1};
            One.put(item1);
            let item2 = {uid: 2};
            One.put(item2);
            let item3 = {uid: 3};
            One.put(item3);

            One.undo();
            One.evict(1);
            // removes subsequent (has item3) and puts a new one without the item.
            expect(One.length()).to.equal(3);
            expect(One.size()).to.equal(1);
            expect(One.get(2)).to.not.be.undefined;
            expect(One.get(1)).to.be.undefined;
            expect(One.get(3)).to.be.undefined;
        })

        it("removes the referenced property from the pulled item " +
            "if its corresponding uid value has been evicted", function () {
            // this is ONLY when a reference is evicted directly (item is deleted), if it is the child of an evicted
            // parent then it should not be evicted since it contains a reference to each of its parents in the
            // REF_FROM array
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            One.put(item2);
            One.evict(item1);
            let result = One.get(2);
            expect(One.size()).to.equal(1);
            expect(One.length()).to.equal(2);

            expect(result.item).to.be.undefined;
            One.undo();
            result = One.get(2);
            expect(result.item).to.not.be.undefined;
            expect(result.item.uid).to.equal(1);
        });

        it("removes a deeper referenced entity when evicting a containing entity up the tree", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            let item  = {
                uid : 3,
                item: item2
            };
            One.put(item);
            One.evict(item);

            expect(One.size()).to.equal(0);
            expect(One.length()).to.equal(2);
        });

        it("doesn't remove a deeper referenced entity when evicting a containing entity up the tree " +
            "if it has other references", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            let item3 = {uid: 3, item: item1};
            let item  = {
                uid : 4,
                item: item2
            };
            One.put(item);
            One.put(item3);
            One.evict(item);
            expect(One.size()).to.equal(2);
            expect(One.length()).to.equal(3);
        });
    });

    describe("cycles", function () {
        // TODO
        it("clears cyclical items", function () {
            // expect(1 === 0, "TODO adapt for cyclical items").to.be.true;
            // One.put("{uid:1}");
            // let item2 = {uid: 2};
            // let item3 = {
            //     uid: 3, item: item2
            // }
            // item2.item = item3;
            // One.put(item3);
            // //One.print();
            // One.evict(3);
            // One.print();
        });
    });
});

