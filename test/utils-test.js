/**
 * Created by maierdesign on 12/20/15.
 * Only need get, del from
 * https://github.com/mariocasciaro/object-path
 */
import {
    expect,
    sinon,
    print,
    contains
} from './test_helper';
import {getCache} from '../src/cache';
import * as config from '../src/utils/config';
import deepFreeze from '../src/utils/deepFreeze'
import {deepClone, isArray, hasUid} from '../src/utils/clone';
import {describe, it} from 'mocha/lib/mocha.js';

describe("Utils", function () {

    "use strict";

    let One;

    beforeEach(function () {
        One = getCache(true);
        // reset config before each call
        One.config({
            uidName         : "uid",
            maxHistoryStates: 1000
        })
    });

    afterEach(function () {
        One.reset();
    });

    function getTestObj() {
        return {
            a: 'b',
            b: {
                c: [],
                d: ['a', 'b'],
                e: [{}, {f: 'g'}],
                f: 'i'
            },
            c: {uid: 1}
        };
    }

    describe("deep-freeze", function () {
        it('should freeze an object deeply', function () {
            let obj = getTestObj();
            deepFreeze(obj);

            expect(() => {
                obj.x = 5
            }).to.throw(TypeError);
            expect(() => {
                obj.prototype.z = 5
            }).to.throw(TypeError);
        });

        it("should not blow up on null object", function () {
            expect(deepFreeze()).to.be.undefined;
        })
    });

    describe("clone", function () {
        it("hasUid should return false on non object", function () {
            expect(hasUid()).to.be.false;
        });

        it("should not clone if not object or array", function () {
            expect(deepClone(2)).to.equal(2);
        });

        it("should clone date", function () {
            let date   = new Date();
            let item1  = {uid: 1, date: date};
            let result = deepClone(item1);
            expect(result.date).to.not.be.undefined;
            expect(result.date === date).to.be.false;
            expect(result.date.time === date.time).to.be.true;
            expect(Object.isFrozen(result.date)).to.be.true;
        });

        it("should clone deeply", function () {
            let obj    = getTestObj();
            let result = deepClone(obj);
            expect(result).to.not.be.undefined;
            expect(obj === result).to.be.false;
            expect(Object.isFrozen(result)).to.be.true;
        });

        it("should replace item", function () {
            let obj    = getTestObj();
            let result = deepClone(obj, {uid: 1, text: "test"});
            expect(result.c).to.not.be.undefined;
            expect(Object.isFrozen(result.c)).to.be.true;
            expect(result.c.text).to.equal("test");
            expect(() => {
                result.c.text = "new"
            }).to.throw(TypeError);
        });

        it("clones an object deeply", function () {
            let date   = new Date();
            let item1  = {uid: 1};
            let item2  = {uid: 2, date: date};
            let item3  = {uid: 3, arr: [1, 2]};
            let item4  = {
                uid : 4,
                arr : [1, item1, "string", [item1, item2]],
                item: item3
            };
            let result = deepClone(item4);
            expect(result === item4).to.be.false;
            expect(result.uid).to.equal(4);
            expect(result.arr[0]).to.equal(1);
            expect(result.arr[1] == item1).to.be.true;
            expect(result.arr[1].uid).to.equal(1);
            expect(result.arr[2]).to.equal("string");

            expect(isArray(result.arr[3])).to.be.true;
            expect(result.arr[3][0] === item1).to.be.true;
            expect(result.arr[3][0].uid).to.equal(1);

            // item 2 inner clone
            expect(result.arr[3][1] === item2).to.be.true;
            expect(result.arr[3][1].uid).to.equal(2);
            // stops at the parent uid item
            expect(result.arr[3][1].date === date).to.be.true;
            expect(result.arr[3][1].date.getTime()).to.equal(date.getTime());
        });

        it("returns the object when cloning with replace of itself", function(){
            let item1 = {uid:1};
            let result = deepClone(item1, item1, false);
            expect(item1 === result).to.be.true;
        });

        it("should replace item not freeze", function () {
            let obj    = getTestObj();
            expect(Object.isFrozen(obj.c)).to.be.false;
            let result = deepClone(obj, {uid: 1, text: "test"}, false);

            expect(result.c).to.not.be.undefined;
            expect(Object.isFrozen(result.c)).to.be.false;
            expect(result.c.text).to.equal("test");
        });

        it("has uid", function () {
            expect(hasUid({uid: 1})).to.be.true;
            expect(hasUid({})).to.be.false;
        })
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

    describe("print", function () {
        it("prints", function () {
            let item  = {uid: 1};
            let item2 = {
                uid  : 2,
                child: item
            };
            One.put(item2);
            expect(One.get(1)).to.not.be.undefined;
            expect(One.print()).to.be.undefined;
        });

        it("prints empty", function () {
            expect(() => {
                One.print()
            }).to.not.throw(Error);
        })
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


