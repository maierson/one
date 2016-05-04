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

describe("One", function () {

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

        it("clears the cache for each test run", function () {
            One.queue({uid: 1});
            One.commit();

            expect(One.size()).to.equal(1);

            One.reset();
            expect(One.size()).to.equal(0);
        });

        it("initializes with no map", function () {
            expect(One).to.not.be.null;
            expect(One.size()).to.equal(0);
            expect(One.length()).to.equal(0);
        });

        it("undoes correctly", function () {
            let item1 = {uid: 1, text: "text"};
            One.put(item1); // main 0
            let item2 = {uid: 2};
            One.put(item2); // main 1
            expect(One.size()).to.equal(2);
            expect(One.length()).to.equal(2);

            One.undo(); // main 0

            expect(One.size()).to.equal(1);

            let state    = One.getHistoryState();
            let mainData = state.threads["main"];
            expect(mainData).to.not.be.undefined;
            expect(mainData.currentIndex).to.equal(0);
            expect(mainData.length).to.equal(2);
            expect(One.get(1)).to.not.be.undefined;
            expect(One.get(1).text).to.equal("text");
        });

        it("re-does correctly", function () {
            let item1 = {uid: 1};
            One.put(item1);
            let item2 = {uid: 2};
            One.put(item2);
            expect(One.size()).to.equal(2);
            expect(One.length()).to.equal(2);
            One.undo();
            One.redo();
            expect(One.size()).to.equal(2);
            let mainData = One.getHistoryState().threads["main"];
            expect(mainData.currentIndex == (mainData.length - 1)).to.be.true;
            expect(mainData.currentIndex > 0).to.be.true;
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

            let state  = One.undo();
            let mainTh = state.threads.main;
            expect(mainTh.currentIndex < mainTh.length - 1).to.be.true;
            expect(mainTh.length).to.equal(2);
            expect(state.success).to.be.true;

            item1      = One.getEdit(1);
            item1.text = "text";
            state      = One.put(item1);
            mainTh     = state.threads.main;

            expect(mainTh.currentIndex < mainTh.length - 1).to.be.false;
            expect(mainTh.length).to.equal(2);
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
            let main  = state.threads.main;

            expect(state.success).to.be.true;
            expect(main.current > 0).to.be.false;
            // also going forward also puts us at the other end
            let redo = One.redo();
            main     = redo.threads.main;
            // since we're already on the last redo (undo didn't move it as it doesn't read the first item in the nodes)
            expect(redo.success).to.be.true;
            expect(main.current > main.length - 1).to.be.false;
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
            }
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

        it("maintains identity of inner items on put if not changed", function () {
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
        });
    });

    describe("queue", function () {

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
        })
    });

    describe("pointer management", function () {
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

        it("keeps previous version pointers when it updates the new ones", function () {
            let item1 = {uid: 1};
            One.put(item1);
            let item = {
                uid : 2,
                item: item1
            }
            One.put(item);
            let resultOne = One.get(1);
            // rewind one and check again
            One.undo();
            expect(One.contains(2)).to.be.false;
            let resultTwo = One.get(1);
            expect(resultOne === resultTwo).to.be.true;
        })

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
            expect(state.threads.main.hasNext).to.be.true;
            state = One.put({uid: 1, text: "text"});
            expect(state.threads.main.hasNext).to.be.false;
            let result = One.get(1);
            expect(result.text).to.equal("text");
        })

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
        })

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

    describe("clear", function () {
        it("clears the cache", function () {
            let item1 = {uid: 1};
            let item2 = {uid: 2};
            let item3 = {
                uid : 3,
                item: item1
            };
            One.put(item3);
            One.put(item2);
            One.reset();
            expect(One.size()).to.equal(0);
            expect(One.length()).to.equal(0);
        })
    });

    describe("config", function () {
        it("sets the config correctly", function () {
            expect(config.prop.uidName).to.equal("uid");
            expect(config.prop.maxHistoryStates).to.equal(1000);

            let newConfig = {
                uidName         : "uniqueId",
                maxHistoryStates: 20
            };
            One.config(newConfig);
            expect(config.prop.maxHistoryStates).to.equal(20);
            expect(config.prop.uidName).to.equal("uniqueId");
        });

        it("fails to set config if there are items in the cache", function () {
            let a = {uid: 1};
            One.put(a);
            let config = {
                uidName: "uuid"
            }
            expect(() => {
                One.config(config)
            }).to.throw(Error);
        });

        it("it configures a cleared cache", function () {
            let a = {uid: 1};
            One.put(a);
            One.reset();
            let conf = {
                uidName: "uniqueId"
            };
            One.config(conf);
            expect(config.prop.uidName).to.equal("uniqueId");
        });

        //it("maintains the correct number of configured history states", function () {
        //    expect(0, "Not impletmented").to.equal(1);
        //});
    });

    describe("notify", function () {
        it("notifies listeners when putting single item", function () {
            let listener1 = sinon.spy();
            let listener2 = sinon.spy();
            One.subscribe(listener1);
            One.subscribe(listener2);
            One.put({uid: 1});
            expect(listener1).to.have.been.called;
            expect(listener2).to.have.been.called;
        });

        it("notifies once when putting array", function () {
            let listener1 = sinon.spy();
            let listener2 = sinon.spy();
            One.subscribe(listener1);
            One.subscribe(listener2);
            One.put([{uid: 1}, {uid: 2}]);
            expect(listener1).to.have.been.calledOnce;
            expect(listener2).to.have.been.calledOnce;
        });

        it("notifies listeners when evicting", function () {
            let listener1 = sinon.spy();
            let listener2 = sinon.spy();
            One.subscribe(listener1);
            One.subscribe(listener2);
            One.put({uid: 1});
            One.evict(1);
            expect(listener1).to.have.been.calledTwice;
            expect(listener2).to.have.been.calledTwice;
        });

        it("does not notify if eviction didn't happen", function () {
            let listener1 = sinon.spy();
            let listener2 = sinon.spy();
            One.subscribe(listener1);
            One.subscribe(listener2);
            One.put({uid: 1});
            One.evict(2);
            expect(listener1).to.have.been.calledOnce;
            expect(listener2).to.have.been.calledOnce;
        });

        it("unsubscribes listener", function () {
            let listener1    = sinon.spy();
            let listener2    = sinon.spy();
            let unsubscribe1 = One.subscribe(listener1);
            let unsubscribe2 = One.subscribe(listener2);
            One.put([{uid: 1}, {uid: 2}]);
            unsubscribe2();
            unsubscribe2(); // verify it does not blow up
            One.evict(2);
            expect(listener1).to.have.been.calledTwice;
            expect(listener2).to.have.been.calledOnce;
        })
    });

    describe("print", function () {
        it("prints", function () {
            One.put({uid: 1});
            expect(One.print()).to.be.undefined;
        });

        it("throws error on getHistoryState invalid param", function () {
            One.put({uid: 1});
            expect(() => {
                One.getHistoryState(true, true)
            }).to.throw(TypeError);
        });
    });

    describe("dirty", function () {
        it("reads non uid item as dirty", function () {
            expect(One.isDirty({})).to.be.true;
            expect(One.isDirty({}, 1)).to.be.true;
        })

    })

    describe("uid", function () {
        it("creates uid", function () {
            expect(One.uuid()).to.not.be.undefined;
        })
    })
});


