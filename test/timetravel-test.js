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

describe("Time travel", function () {

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

    it("undoes correctly", function () {
        let item1 = {uid: 1, text: "text"};
        one.put(item1); // main 0
        let item2 = {uid: 2};
        one.put(item2); // main 1
        expect(one.size()).to.equal(2);
        expect(one.length()).to.equal(2);

        one.undo(); // main 0

        expect(one.size()).to.equal(1);

        let state    = one.getHistoryState();
        expect(state.index).to.equal(0);
        expect(state.length).to.equal(2);
        expect(one.get(1)).to.not.be.undefined;
        expect(one.get(1).text).to.equal("text");
    });

    it("re-does correctly", function () {
        let item1 = {uid: 1};
        one.put(item1);
        let item2 = {uid: 2};
        one.put(item2);
        expect(one.size()).to.equal(2);
        expect(one.length()).to.equal(2);
        one.undo();
        one.redo();
        expect(one.size()).to.equal(2);
        let state = one.getHistoryState();
        expect(state.hasNext).to.be.false;
        expect(state.hasPrev).to.be.true;
    });

    it("gets the correct index", function () {
        one.put({uid: 1});
        one.put({uid: 1, text: "text"});
        one.put({uid: 1, text: "another"});
        one.undo();
        expect(one.index()).to.equal(1);
    });

    it("sets the correct index", function () {
        one.put({uid: 1});
        one.put({uid: 1, text: "text"});
        one.put({uid: 1, text: "another"});
        one.index(1);
        expect(one.get(1).text).to.equal("text");
        one.index(0);
        expect(one.get(1).text).to.be.undefined;
    });

    it("blows up on out of bounds", function () {
        one.put({uid: 1});
        one.put({uid: 1, text: "text"});
        one.put({uid: 1, text: "another"});
        expect(()=> {
            one.index(-1)
        }).to.throw(TypeError);
        expect(()=> {
            one.index(5)
        }).to.throw(TypeError);
    });

    it("fails silently when setting invalid index", function () {
        expect(() => {
            one.index(true)
        }).to.not.throw(Error);
    });

    it("fails silently if setting the same index", function () {
        one.put({uid: 1});
        one.put({uid: 1, text: "text"});
        one.put({uid: 1, text: "another"});
        one.undo();
        expect(one.index()).to.equal(1);
        expect(one.get(1).text).to.equal("text");
        expect(() => {
            one.index(1)
        }).to.not.throw(Error);
        expect(one.index()).to.equal(1);
        expect(one.get(1).text).to.equal("text");
    });

    it("should get the current node", function () {
        one.put({uid: 1});
        one.put({uid: 2});
        one.put({uid: 3});
        let node3 = one.node();
        expect(one.node()).to.equal(2);
        one.undo();
        expect(one.node()).to.equal(1);
        one.undo();
        expect(one.node()).to.equal(0);
    });

    it("throws on non number node", function () {
        expect(() => {
            one.node("1")
        }).to.throw(TypeError);
    });

    it("fails on non existing node", function () {
        let state = one.node(1);
        expect(state.success).to.be.false;
    });

    it("should travel to the correct node when node index is below current node", function () {
        one.put({uid: 1});
        one.put({uid: 2});
        one.put({uid: 3});
        let state = one.node(1);
        expect(state.success).to.be.true;
        expect(one.get(2)).to.not.be.undefined;
        expect(one.get(3)).to.be.undefined;
        one.node(2);
    });

    it("should travel to the correct node when node index is above current node", function () {
        one.put({uid: 1});
        one.put({uid: 2});
        one.put({uid: 3});
        one.undo();
        let state = one.node(2);
        expect(state.success).to.be.true;
        expect(one.get(2)).to.not.be.undefined;
        expect(one.get(3)).to.not.be.undefined;
    });

    it("should travel to the correct node when node index is smallest", function () {
        one.put({uid: 1});
        one.put({uid: 2});
        one.put({uid: 3});
        one.put({uid: 4});
        one.put({uid: 5});
        one.undo();
        one.undo();

        expect(one.get(2)).to.not.be.undefined;
        expect(one.get(3)).to.not.be.undefined;

        let state = one.node(0);
        expect(state.success).to.be.true;
        expect(one.get(2)).to.be.undefined;
        expect(one.get(3)).to.be.undefined;
    });

    it("returns -1 on node() if cache is empty", function(){
       expect(one.node()).to.equal(-1);
    });
});


