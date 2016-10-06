/**
 * Created by maierdesign on 12/20/15.
 */
import {
    expect,
    sinon,
    print,
    contains
} from './test_helper';
import * as config from '../src/utils/config';
import {deepClone, isArray} from '../src/utils/clone';
import * as path from "../src/utils/path";
import {describe, it} from 'mocha/lib/mocha.js';
import * as One from  '../src/cache';

describe("IO", function () {

    "use strict";

    let one;

    function printCache() {
        print(one, "CACHE");
    }

    beforeEach(function () {
        // reset config before each call
        one = One.getCache(true);
        one.config({
            uidName:"uid",
            maxHistoryState: 1000
        });
    });

    afterEach(function () {
        one.reset();
    });

    describe("put / get", function () {

        it("returns singleton instance", function(){
           expect(One.getCache() === One.getCache()).to.be.true;
        });

        it("finds cache-uid", function () {
            expect(one).to.not.be.undefined;
        });

        it("initializes with no map", function () {
            console.log("One " + JSON.stringify(one))
            expect(one).to.not.be.null;
            expect(one.size()).to.equal(0);
            expect(one.length()).to.equal(0);
        });

        it("puts frozen object", function () {
            let item1 = {uid: 1};
            let item2 = {uid: "2", item: item1, otherItem: undefined};
            one.put(item2);

            expect(one.size()).to.equal(2);
            expect(one.length()).to.equal(1);

            let result2 = one.get(2);
            expect(result2.uid).to.equal("2");
            expect(result2.item.uid).to.equal(1);

            expect(Object.isFrozen(result2)).to.be.true;

            // also can retrieve 1 separately
            let result1 = one.get(1);
            expect(result1).to.not.be.undefined;
            expect(result1.uid).to.equal(1);
            expect(Object.isFrozen(result1)).to.be.true;
        });

        it("puts simple array correctly", function () {
            let item = {uid: 1, items: ["one", "two", "three"]};
            one.put(item);
            let result = one.getEdit(1);
            result.items.push("four");
            result.items.push("five");
            one.put(result);
            expect(one.get(1).items.length).to.equal(5);
            expect(one.get(1).items[3]).to.equal("four");
            expect(one.get(1).items[4]).to.equal("five");
        });

        it("freezes entity deeply", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            let item3 = {
                uid : 3,
                item: item2
            };
            one.put(item3);
            let result = one.get(3);
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
            one.put(item);
            let result = one.get(1);
            expect(result).to.not.be.undefined;
            expect(() => {
                result.test = "something";
            }).to.throw(TypeError);
        });

        it("does not put the entity if not changed", function () {
            let item1 = {uid: 1};
            let state = one.put(item1);
            expect(state.success).to.be.true;
            state = one.put(item1);
            expect(state.success).to.be.false;
        });

        it("puts array from top entity that has no uid", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, items: [item1]};
            let item  = {
                val  : "test",
                items: [item2]
            };
            one.put(item);
            expect(one.get(1)).to.not.be.undefined;
            expect(one.get(2)).to.not.be.undefined;
            expect(one.size()).to.equal(2);
            expect(one.length()).to.equal(1);
        });

        it("updates parent when inner uid ref changed but keeps other children references unchanged", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {
                uid  : 3,
                item1: item1,
                item2: item2
            };
            one.put(item3);

            let item4 = {uid: 4};
            one.put(item4);
            let edit1  = one.getEdit(1);
            edit1.item = item4;
            one.put(edit1);

            let result = one.get(3);
            expect(item2 === result.item2).to.be.true;
            let result2 = one.get(2);
            expect(item2 === result2).to.be.true;
        });

        it("updates parent when inner uid ref changed " +
            "but keeps other children references unchanged in ARRAY", function () {
            let item  = {uid: "item"};
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {
                uid     : 3,
                item    : item,
                children: [item1, item2]
            };
            one.put(item3);

            let item4 = {uid: 4};
            one.put(item4);
            let edit1  = one.getEdit(1);
            edit1.item = item4;
            one.put(edit1);

            let itemResult = one.get("item");
            expect(item === itemResult).to.be.true;
            let result = one.get(3);
            expect(item2 === result.children[1]).to.be.true;
            let result2 = one.get(2);
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
            one.put(arr);
            expect(one.get(1)).to.not.be.undefined;
            expect(one.get(firstItem)).to.not.be.undefined;
            expect(one.get(2)).to.not.be.undefined;
            expect(one.get(4)).to.not.be.undefined;
            expect(one.get(3)).to.not.be.undefined;
            expect(one.length()).to.equal(1);
            expect(one.size()).to.equal(5);
        });

        it("puts array of items", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {uid: 3, item: item2};
            one.put([item1, item3]);
            expect(one.size()).to.equal(3);
            expect(one.length()).to.equal(1);
            expect(one.get(1)).to.not.be.undefined;
            expect(one.get(2)).to.not.be.undefined;
            expect(one.get(3)).to.not.be.undefined;
        });

        it("gets array of items in requested order", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {uid: 3, item: item2};
            one.put([item1, item3]);
            let result = one.get([1, 3, item2]);
            expect(isArray(result)).to.be.true;
            expect(result[0].uid).to.equal(1);
            expect(result[1].uid).to.equal(3);
            expect(result[2].uid).to.equal(2);
            // aslo check identity
            expect(item2 === result[1].item).to.be.true;
        });

        it("gets undefined for non existing cached item", function () {
            expect(one.get(1)).to.be.undefined;
            expect(one.getEdit(1)).to.be.undefined;
            expect(one.get({uid: 1})).to.be.undefined;
        });

        it("gets editable entity that is a clone of the cached entity", function () {
            let item1 = {uid: 1};
            one.put(item1);
            let result     = one.get(1);
            let resultEdit = one.getEdit(1);
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
            one.put([item1, item3]);
            let result = one.getEdit([1, 3, item2]);

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
            one.put(item);

            // check object reference to be frozen and identical to original
            let result = one.get(1);
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
            let editableResult = one.getEdit(1);
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
            one.put(item2);
            let result = one.get(2);
            expect(result.item === item1).to.be.true;

            result = one.getEdit(2);
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
            one.put(item3);
            let result = one.getEdit(3);
            expect(result.items[0] === item1).to.be.true;
            expect(Object.isFrozen(result.items[0])).to.be.true;
            expect(result.items[1] === item2).to.be.true;
            expect(Object.isFrozen(result.items[1])).to.be.true;
        });

        it("throws error if getting without an item or uid", function () {
            expect(() => {
                one.get();
            }).to.throw(TypeError);
        });

        it("detects shallow dirty entity", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            one.put(item1);
            expect(one.isDirty(item1)).to.be.false;
            expect(one.isDirty(item2)).to.be.true;
            expect(one.isDirty(one.get(1))).to.be.false;
            expect(one.isDirty(one.getEdit(1))).to.be.true;
        });

        // this goes one back, removes all the items after the current state
        // and adds a new state with the appropriate changes
        it("puts and updates entity correctly after undo", function () {
            let item1 = {uid: 1};
            one.put(item1);
            let item2 = {uid: 2, item: item1};
            one.put(item2);

            let state = one.undo();
            expect(state.success).to.be.true;
            expect(state.hasPrev).to.be.false;
            expect(state.hasNext).to.be.true;

            item1      = one.getEdit(1);
            item1.text = "text";
            state      = one.put(item1);
            expect(one.get(1).text).to.equal("text");
        });

        it("replaces existing props on existing entity when putting new entity that does not have them", function () {
            let item = {
                uid     : 1,
                test    : "test",
                children: [
                    "one", "two"
                ]
            };
            one.put(item);
            item = {
                uid     : 1,
                some    : "some",
                children: [
                    "three", "one"
                ]
            };
            one.put(item);

            let result = one.get(1);
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
            one.put(arr);
            expect(one.length()).to.equal(1);
            expect(one.size()).to.equal(3);
            expect(one.get(1)).to.not.be.undefined;
            expect(one.get(2)).to.not.be.undefined;
            expect(one.get(3)).to.not.be.undefined;
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
            one.put(arr);
            expect(one.length()).to.equal(1);
            expect(one.size()).to.equal(3);
            expect(one.get(1)).to.not.be.undefined;
            let res2 = one.get(2);
            expect(res2).to.not.be.undefined;
            expect(res2.item.uid).to.equal(1);
            let res3 = one.get(3);
            expect(res3).to.not.be.undefined;
            expect(res3.children[0].uid).to.equal(1);
        });

        it("does not add to cache if no uid", function () {
            let existing = {uid: ""};
            one.put(existing);
            expect(one.size()).to.equal(0);
            expect(one.length()).to.equal(0);
        });

        it("adds new item to the cache", function () {
            let item = {uid: 1, value: "one"};
            one.put(item);
            expect(one.size()).to.equal(1);
            expect(one.length()).to.equal(1);
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
            one.put(item);

            // all items with uid are added to the cache
            expect(one.size()).to.equal(4);
            expect(one.get(1)).to.not.be.undefined;

            let item2 = one.get(2);
            expect(item2).to.not.be.undefined;
            expect(item2.value).to.equal("two");

            let item3 = one.get(3);
            expect(item3).to.not.be.undefined;
            expect(item3.value).to.equal("three");

            let item4 = one.get(4);
            expect(item4).to.not.be.undefined;
            expect(item4.value).to.equal("four");

            // only one extra cache state is added
            expect(one.length()).to.equal(1);
            // with undo we are at the beginning of the nodes array
            one.put({uid: 100});
            let state = one.undo();

            expect(state.success).to.be.true;
            expect(state.index).to.equal(0);

            // also going forward also puts us at the other end
            state = one.redo();
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
            one.put(item3);
            expect(one.length()).to.equal(1);
            expect(one.size()).to.equal(3);

            // at this point item1 is frozen. To continue editing must get a copy
            item1      = one.getEdit(1);
            // change item 1 and make sure it modified in item2 on current state but not previous
            item1.text = "text";
            one.put(item1);
            let result = one.get(3);
            expect(result.otherItem.nested.text).to.equal("text");
            one.undo();
            result = one.get(3);
            expect(result.otherItem.nested.text).to.be.undefined;
        });

        it("updates all pointing parents when putting and entity updated deeply inside another", function () {
            let item1 = {uid: 1, val: "one"};
            let item2 = {
                uid : 2,
                item: item1
            };
            one.put(item2);
            let otherItem1 = {
                uid: 1,
                val: "two"
            };
            let item3      = {
                uid  : 3,
                other: otherItem1
            };
            one.put(item3);
            let result = one.get(2);
            expect(result.item.val).to.equal("two");
        });

        it("updates all pointing parents when putting and entity updated deeply inside another's array", function () {
            let item1 = {uid: 1, val: "one"};
            let item2 = {
                uid : 2,
                item: item1
            };
            one.put(item2);
            let otherItem1 = {
                uid: 1,
                val: "two"
            };
            let item3      = {
                uid   : 3,
                others: [otherItem1]
            };
            one.put(item3);
            let result = one.get(2);
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
            one.put(item2);
            expect(one.length()).to.equal(1);
            expect(one.size()).to.equal(2);

            // change item 1 and make sure it modified in item2 on current state but not previous
            item1      = one.getEdit(item1);
            item1.text = "text";
            one.put(item1);
            let result = one.get(2);
            expect(result.item.nested.deep.text).to.equal("text");
            one.undo();
            result = one.get(2);
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
            one.put(item2);
            expect(one.length()).to.equal(1);
            expect(one.size()).to.equal(2);

            // change item 1 and make sure it modified in item2 on current state but not previous
            item1      = one.getEdit(item1);
            item1.text = "text";

            one.put(item1);

            let result = one.get(2);

            expect(result.item.nested[0].text).to.equal("text");
            one.undo();
            result = one.get(2);
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
            one.put(item);

            // check state
            expect(one.size()).to.equal(6);
            expect(one.length()).to.equal(1);

            // check items
            const result1 = one.get(1);
            expect(result1.children.length).to.equal(2);
            expect(result1.children[0].uid).to.equal(2);
            expect(result1.children[1].uid).to.equal(3);
            const result2 = one.get(2);
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
            one.put(item2);
            const result = one.get(2);
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
            one.put(item);

            expect(one.size()).to.equal(4);

            let item1 = one.get(1);
            expect(item1).to.not.be.undefined;
            expect(item1.children).to.be.an("array");
            expect(item1.children.length).to.equal(1);

            let child1 = item1.children[0];
            expect(child1).to.be.an("array");
            expect(child1.length).to.equal(2);

            let item2 = one.get(2);
            expect(item2).to.not.be.undefined;
            expect(item2.value).to.equal("two");

            let item3 = one.get(3);
            expect(item3).to.not.be.undefined;
            expect(item3.children).to.be.an("Array");
            expect(item3.children.length).to.equal(1);

            let item4 = one.get(4);
            expect(item4).to.not.be.undefined;
            expect(item4.value).to.equal("four");

            expect(one.length()).to.equal(1);
        });

        it("freezes previous versions of the nodes", function () {
            let item1 = {
                uid     : 1,
                children: [
                    {uid: 2}
                ]
            };
            one.put(item1);
            let result = one.getCurrentNode();
            expect(result).to.not.be.undefined;
            expect(one.size()).to.equal(2);
            try {
                result.items.delete(1);
            } catch (err) {
                console.log("ERROR remove from cache:" + err.message);
            }
            expect(one.size()).to.equal(2);
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
            one.put(original);

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
            one.put(item);

            let editableItem = one.getEdit(1);
            editableItem.children.pop();
            editableItem.children.push(item4);

            one.put(editableItem);

            let result = one.get(1);
            expect(result.children[0].uid).to.equal(4);
            expect(one.refFrom(4)["1"][0]).to.equal("children.0");
            expect(one.refTo(1)["3"]).to.be.undefined;
            expect(one.refTo(1)["4"][0]).to.equal("children.0");
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
            one.put(item);
            expect(one.length()).to.equal(1);
            expect(Object.isFrozen(item), "Cached item is not frozen").to.be.true;
            expect(item === one.get(1), "Cached item is not identical to passed in item").to.be.true;
            one.put(item);
            expect(one.length()).to.equal(1);
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

            one.put(item2);

            let otherItem1 = {
                uid  : 1,
                value: "two"
            };

            let item3 = {
                uid      : 3,
                item     : item1,
                otherItem: otherItem1
            };
            one.put(item3);

            let result = one.get(2);

            expect(result.child.uid).to.equal(1);
            expect(result.children[0].uid).to.equal(1);
            expect(result.child === result.children[0]).to.be.true;

            let result3 = one.get(3);
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
            one.put(item2);
            let result = one.get(2);
            expect(result.child).to.equal(null);
        });

        it("returns item if primitive", function () {
            expect(one.put(1).success).to.be.false;
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
            expect(one.put(item).success).to.be.true;
            expect(one.put(item).success).to.be.false;
        });
    });

    describe("get", function () {
        it("gets an entire array by uid", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {uid: 3};
            let item4 = {uid: 4, items: [item1, item2]};
            one.put([item1, item2, item3, item4]);
            let result = one.get([1, 2, 4]);
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
            one.put([item1, item2, item3, item4]);
            let result = one.get([item1, item2, item4]);
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
            one.put([item1, item2, item3, item4]);
            let result = one.get([1, item2, 4]);
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
            one.put([item1, item2, item]);
            let result = one.get([1, 2, item]);
            expect(isArray(result)).to.be.true;
            expect(result.length).to.equal(2);
            expect(result[0].uid).to.equal(1);
            expect(result[1].uid).to.equal(2);
        });

    });

    describe("evict", function () {

        it("returns false if nothing evicted", function () {
            expect(one.evict({})).to.be.false;
            expect(one.evict()).to.be.false;
            expect(one.evict(true)).to.be.false;
        });

        it("fails on non existing uid", function () {
            expect(one.evict(["one", 1])).to.be.false;
        })

        it("removes item from cache when evicting", function () {
            let item1 = {uid: 1, value: "test"};
            one.put(item1);
            one.evict(item1);

            expect(one.size()).to.equal(0);
            expect(one.length()).to.equal(2);
        });

        it("evicts non-referenced items when parent is evicted", function () {
            let item1  = {uid: 1};
            let parent = {
                uid : 2,
                item: item1
            };
            one.put(parent);
            one.evict(parent);
            expect(one.length()).to.equal(2);
            expect(one.size()).to.equal(0);
        });

        it("doesn't evict referenced items when parent is evicted", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            let item3 = {uid: 3, item: item1};
            one.put(item2);
            one.put(item3);
            one.evict(item3);

            expect(one.length()).to.equal(3);
            expect(one.size()).to.equal(2);

            expect(one.get(1)).to.not.be.undefined;
            expect(one.refFrom(1)["2"].length).to.equal(1);
            expect(one.refFrom(1)["2"][0]).to.equal("item");
            expect(one.refFrom(1)["3"]).to.be.undefined;

            one.evict(item2);
            expect(one.length()).to.equal(4);
            expect(one.size()).to.equal(0);
            expect(one.get(1)).to.be.undefined;
        });

        it("clears references from an item that was removed from a parent being put", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, val: item1};
            one.put(item2);

            let editable = one.getEdit(2);
            editable.val = undefined;
            one.put(editable);

            expect(one.get(1)).to.be.undefined;
            expect(one.refTo(2)["1"]).to.be.undefined;
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
            one.put(arr);
            one.evict(arr);
            expect(one.size()).to.equal(0);
            expect(one.length()).to.equal(2);
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
                item: item1,
                otherItem: item2
            };
            let arr   = [item1, item2, item3, item4];
            one.put(arr);
            one.evict([item2, item3]);

            expect(one.size()).to.equal(2);
            expect(one.length()).to.equal(2);
            expect(one.get(1)).to.not.be.undefined;
            expect(one.get(4)).to.not.be.undefined;
            expect(one.get(2)).to.be.undefined;
            expect(one.get(3)).to.be.undefined;
        });

        it("removes references from left over pointing items when evicting an entity", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            let item3 = {uid: 3, item: item1};
            one.put([item2, item3]);
            one.evict(item1);
            expect(one.refTo(2)["1"]).to.be.undefined;
            expect(one.refTo(3)["1"]).to.be.undefined;
        });

        it("removes entity array referenced when deleting array from parent", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, children: [item1]};
            one.put(item2);

            let editable      = one.getEdit(2);
            editable.children = undefined;
            one.put(editable);

            expect(one.refTo(2)["1"]).to.be.undefined;
            expect(one.get(1)).to.be.undefined;
        });

        it("removes entity array referenced when removed from array", function () {
            let item1 = {uid: 1};
            let item2 = {
                uid  : 2,
                item : item1,
                items: [item1]
            };
            one.put(item2); // 0

            let editable = one.getEdit(2);
            delete editable.item;
            one.put(editable);

            expect(one.refFrom(1)["2"].length).to.equal(1);

            editable       = one.getEdit(2);
            editable.items = undefined;
            one.put(editable);

            expect(one.get(1)).to.be.undefined;
            expect(one.refTo(2)["1"]).to.be.undefined;
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
            one.put(item2); // 0

            expect(one.size()).to.equal(4);

            let editable = one.getEdit(2);
            delete editable.item;
            editable.items = [];

            one.put(editable); // 1

            let result = one.get(1);
            expect(result).to.not.be.undefined;

            editable = one.getEdit(3);
            delete editable.item;
            one.put(editable);

            result = one.get(1);
            expect(one.get(3)).to.not.be.undefined;
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

            one.put(item2);
            let result = one.get(2);

            let refFrom = one.refFrom(1);
            expect(refFrom["2"]).to.not.be.undefined;
            expect(isArray(refFrom["2"])).to.be.true;
            expect(refFrom["2"][0]).to.equal("rootItem");
            expect(refFrom["2"][1]).to.equal("ref.inner.item");

            let refTo = one.refTo(2);
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
            one.put(item3);

            let refTo = one.refTo(3);
            expect(refTo["1"]).to.be.undefined;
        });

        it("builds the prop chain correctly for array", function () {
            let item  = {uid: 1};
            let item2 = {
                uid  : 2,
                items: [item]
            };
            one.put(item2);
            expect(one.refTo(2)["1"][0]).to.equal("items.0");
            expect(one.refFrom(1)["2"][0]).to.equal("items.0");
        });

        it("builds the prop chain correctly for nested array", function () {
            let item  = {uid: 1};
            let item2 = {
                uid  : 2,
                items: [item, [item]]
            };
            //TODO maybe keep track of number of refs inside an array to know how deep to search (might be overkill and
            // better to just iterate the array to the end when removing references
            one.put(item2);
            expect(one.refTo(2)["1"][0]).to.equal("items.0");
            expect(one.refFrom(1)["2"][0]).to.equal("items.0");
        });

        it("removes references within array when deleting item from cache", function () {
            let item1  = {uid: 1};
            let item1a = {uid: "1a"};
            let item3  = {uid: 3, item: item1, item2: item1a};
            let item2  = {uid: 2, items: [item1, item3]};
            one.put([item2, item3]);

            items = one.get(2).items;
            expect(items.length).to.equal(2);

            one.evict(3);

            expect(one.get("1a")).to.be.undefined;
            let items = one.get(2).items;
            expect(items.length).to.equal(1);
            expect(items[0].uid).to.equal(1);

            // make sure it didn't alter the previous node
            one.undo();
            items = one.get(2).items;
            expect(items.length).to.equal(2);
        });

        it("creates new entity when updating through a referenced entity", function () {
            let item1 = {uid: 1};
            one.put(item1);
            let item2 = {uid: 2, item: {uid: 1, test: "test"}};
            one.put(item2);
            let result = one.get(1);
            expect(result.test).to.equal("test");
            one.undo();
            result = one.get(1);
            expect(result.test).to.be.undefined;
        });

        it("removes all subsequent states when undo-ing and modifying a state", function () {
            "use strict";
            let item1 = {uid: 1};
            one.put(item1);
            let item2 = {uid: 2};
            one.put(item2);
            let state = one.undo();
            expect(state.hasNext).to.be.true;
            state = one.put({uid: 1, text: "text"});
            expect(state.hasNext).to.be.false;
            let result = one.get(1);
            expect(result.text).to.equal("text");
        });

        it("removes subsequent states when evicting", function () {
            let item1 = {uid: 1};
            one.put(item1);
            let item2 = {uid: 2};
            one.put(item2);
            let item3 = {uid: 3};
            one.put(item3);

            one.undo();
            one.evict(1);
            // removes subsequent (has item3) and puts a new one without the item.
            expect(one.length()).to.equal(3);
            expect(one.size()).to.equal(1);
            expect(one.get(2)).to.not.be.undefined;
            expect(one.get(1)).to.be.undefined;
            expect(one.get(3)).to.be.undefined;
        })

        it("removes the referenced property from the pulled item " +
            "if its corresponding uid value has been evicted", function () {
            // this is ONLY when a reference is evicted directly (item is deleted), if it is the child of an evicted
            // parent then it should not be evicted since it contains a reference to each of its parents in the
            // REF_FROM array
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            one.put(item2);
            one.evict(item1);
            let result = one.get(2);
            expect(one.size()).to.equal(1);
            expect(one.length()).to.equal(2);

            expect(result.item).to.be.undefined;
            one.undo();
            result = one.get(2);
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
            one.put(item);
            one.evict(item);

            expect(one.size()).to.equal(0);
            expect(one.length()).to.equal(2);
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
            one.put(item);
            one.put(item3);
            one.evict(item);
            expect(one.size()).to.equal(2);
            expect(one.length()).to.equal(3);
        });

        it("doesn't replace existing entities when putting weak", function () {
            let item1 = {uid: 1};
            one.put(item1);
            let item1a = {uid: 1};
            let item2  = {uid: 2, item: item1a};

            // putting weak should not replace item1 in the cache
            one.put(item2, false);
            let result = one.get(1);
            expect(result === item1a).to.be.false;
            expect(result === item1).to.be.true;
        });

        it("doesn't replace existing entities when putting weak new version inside array", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2, item: item1};
            one.put(item2);
            let item1a = {uid: 1};
            // put it weakly
            one.put([item1a], false);
            let result = one.get(1);
            expect(result === item1).to.be.true;
            expect(result === item1a).to.be.false;
        });

        it("doesn't replace direct existing entity on weak put", function () {
            let item1  = {uid: 1};
            let item1a = {uid: 1, val: "value"};
            one.put(item1);
            one.put(item1a, false);
            let result = one.get(1);
            expect(result.val).to.be.undefined;
        });

        /* Not sure this should be the lib's responsiblity - it involves scanning ALL arrays
        in ALL entities in the cache */
        //it("evicts the uid property if existing inside an array", function(){
        //    let item1 = {uid:1234};
        //    let item2 = {uid:2, uids:[1234]};
        //    One.getCache().put([item1, item2]);
        //    let result = One.getCache().get(1234);
        //    expect(result).to.not.be.undefined;
        //    One.getCache().evict(1234);
        //    result = One.getCache().get(1234);
        //    expect(result).to.be.undefined;
        //
        //    One.getCache().print();
        //    result = One.getCache().get(2);
        //    expect(result.uids.length).to.equal(0);
        //});

        it("updates the entire hyerarchy chain upwards when an entity is removed", function(){
            let item1 = {uid:1};
            let item2 = {
                uid:2,
                item: item1
            };
            let item3 = {
                uid:3,
                item : item2
            };
            one.put(item3);
            one.evict(1);
            let result3 = one.get(3);
            // parents are updated on a timeout to clear the stack - must wait here.
            setTimeout(function(){
                expect(result3.item.item).to.be.undefined;
            });
        });

        it("updates the entire hyerarchy chain upwards with arrays when an entity is removed", function(){
            let item1 = {uid:1};
            let item2 = {
                uid:2,
                items:[item1]
            };
            let item3 = {
                uid:3,
                item : item2
            };
            one.put(item3);
            one.evict(1);
            let result3 = one.get(3);
            setTimeout(function(){
                expect(result3.item.items.length).to.equal(0);
            });
        });

        it("updates the entire hierarchy upwards when an embedded entity is removed from target", function(){
            let item1 = {
                uid: 1,
                item: {
                    test:"test"
                }
            };
            let item2 = {
                uid:2,
                item: item1
            };
            one.put(item2);

            item1 = one.getEdit(1);
            delete item1.item;
            one.put(item1);
            expect(one.get(2).item.item).to.be.undefined;
        })
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

    //describe("regexp", function () {
    //    it("does some", function(){
    //        let testString =
    // "imageLeft:-77;imageTop:0;imageWidth:455;imageRotate:0,5;servingWidth:1027;textAlign:center;" +
    // "fontFamily:Raleway;fontSize:12px;left:0;right:0;top;15px;bottom:20px;mucky:none;stroumpf:bombom;morestuff:ya" +
    // "andso:again;etc:andsoon"; let cssName    = "etc"; let result; var i, len; let regexp = new RegExp(cssName +
    // ":(.*?)(;|$)"); let cssMap = {};  console.time("css"); for (i = 0; i < 10000; i++) { if(!cssMap[cssName]){
    // cssMap[cssName] = new RegExp(cssName + ":(.*?)(;|$)"); } result     = testString.match(cssMap[cssName])[1]; }
    // console.timeEnd("css");  console.time("loop"); for(var j = 0 ; j < 10000; j++){ let arr = testString.split(";");
    // len = arr.length; for (i = 0; i < len; i++) { let pair = arr[i]; let key  = cssName + ":"; if (pair.indexOf(key)
    // > -1) { pair = pair.replace(key, ""); result = pair; break; } } } console.timeEnd("loop");
    // console.log("result:", result); });  it("does someting ", function(){ let testString =
    // "imageLeft:-77;imageTop:0;imageWidth:455;imageRotate:0,5;servingWidth:1027;textAlign:center;" + "fontFamily:Raleway;fontSize:12px;left:0;right:0;top;15px;bottom:20px;mucky:none;stroumpf:bombom;morestuff:ya" + "andso:again;etc:andsoon"; let cssName = "servingWidth"; let result; //let regexp = new RegExp(cssName+ ":(.;*?)"); let regexp = new RegExp("(?=" + cssName + ":).+?(?=;|$)"); //let regexp = new RegExp("(?=" + cssName + ":)(.*?)"); console.log(regexp); result = testString.match(regexp)[0]; console.log(result); })  });
});


