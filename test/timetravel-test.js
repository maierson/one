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

describe("Time travel", function () {

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
        expect(state.index).to.equal(0);
        expect(state.length).to.equal(2);
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
        let state = One.getHistoryState();
        expect(state.hasNext).to.be.false;
        expect(state.hasPrev).to.be.true;
    });

    it("gets the correct index", function () {
        One.put({uid: 1});
        One.put({uid: 1, text: "text"});
        One.put({uid: 1, text: "another"});
        One.undo();
        expect(One.index()).to.equal(1);
    });

    it("sets the correct index", function () {
        One.put({uid: 1});
        One.put({uid: 1, text: "text"});
        One.put({uid: 1, text: "another"});
        One.index(1);
        expect(One.get(1).text).to.equal("text");
        One.index(0);
        expect(One.get(1).text).to.be.undefined;
    });

    it("blows up on out of bounds", function () {
        One.put({uid: 1});
        One.put({uid: 1, text: "text"});
        One.put({uid: 1, text: "another"});
        expect(()=> {
            One.index(-1)
        }).to.throw(TypeError);
        expect(()=> {
            One.index(5)
        }).to.throw(TypeError);
    });

    it("fails silently when setting invalid index", function () {
        expect(() => {
            One.index(true)
        }).to.not.throw(Error);
    });

    it("fails silently if setting the same index", function () {
        One.put({uid: 1});
        One.put({uid: 1, text: "text"});
        One.put({uid: 1, text: "another"});
        One.undo();
        expect(One.index()).to.equal(1);
        expect(One.get(1).text).to.equal("text");
        expect(() => {
            One.index(1)
        }).to.not.throw(Error);
        expect(One.index()).to.equal(1);
        expect(One.get(1).text).to.equal("text");
    });

    it("should get the current node", function () {
        One.put({uid: 1});
        One.put({uid: 2});
        One.put({uid: 3});
        let node3 = One.node();
        expect(One.node()).to.equal(2);
        One.undo();
        expect(One.node()).to.equal(1);
        One.undo();
        expect(One.node()).to.equal(0);
    });

    it("throws on non number node", function () {
        expect(() => {
            One.node("1")
        }).to.throw(TypeError);
    });

    it("fails on non existing node", function () {
        let state = One.node(1);
        expect(state.success).to.be.false;
    });

    it("should travel to the correct node when node index is below current node", function () {
        One.put({uid: 1});
        One.put({uid: 2});
        One.put({uid: 3});
        let state = One.node(1);
        expect(state.success).to.be.true;
        expect(One.get(2)).to.not.be.undefined;
        expect(One.get(3)).to.be.undefined;
        One.node(2);
    });

    it("should travel to the correct node when node index is above current node", function () {
        One.put({uid: 1});
        One.put({uid: 2});
        One.put({uid: 3});
        One.undo();
        let state = One.node(2);
        expect(state.success).to.be.true;
        expect(One.get(2)).to.not.be.undefined;
        expect(One.get(3)).to.not.be.undefined;
    });

    it("should travel to the correct node when node index is smallest", function () {
        One.put({uid: 1});
        One.put({uid: 2});
        One.put({uid: 3});
        One.put({uid: 4});
        One.put({uid: 5});
        One.undo();
        One.undo();

        expect(One.get(2)).to.not.be.undefined;
        expect(One.get(3)).to.not.be.undefined;

        let state = One.node(0);
        expect(state.success).to.be.true;
        expect(One.get(2)).to.be.undefined;
        expect(One.get(3)).to.be.undefined;
    });

    it("returns -1 on node() if cache is empty", function(){
       expect(One.node()).to.equal(-1);
    });
});


