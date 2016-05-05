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
    });

    describe("Time travel", function () {

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
            expect(() => {One.index(true)}).to.not.throw(Error);
        });
    });
});


