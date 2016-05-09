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
import deepFreeze from '../src/utils/deepFreeze'
import {deepClone, isArray, hasUid} from '../src/utils/clone';
import {describe, it} from 'mocha/lib/mocha.js';

describe("Utils", function () {

    "use strict";

    beforeEach(function () {

    });

    afterEach(function () {

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

        it("should replace item not freeze", function () {
            let obj    = getTestObj();
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
});


