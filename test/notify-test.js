/**
 * Created by maierdesign on 12/20/15.
 */
import {
    expect,
    sinon,
    print,
    contains
} from './test_helper';
//import createCache from '../src/cache';
import {getCache} from '../src/cache';
import * as config from '../src/utils/config';
import {deepClone, isArray} from '../src/utils/clone';
import * as path from "../src/utils/path";
import {describe, it} from 'mocha/lib/mocha.js';

describe("Notify", function () {

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

    it("notifies listeners when putting single item", function () {
        let listener1 = sinon.spy();
        let listener2 = sinon.spy();
        one.subscribe(listener1);
        one.subscribe(listener2);
        one.put({uid: 1});
        expect(listener1).to.have.been.called;
        expect(listener2).to.have.been.called;
    });

    it("notifies once when putting array", function () {
        let listener1 = sinon.spy();
        let listener2 = sinon.spy();
        one.subscribe(listener1);
        one.subscribe(listener2);
        one.put([{uid: 1}, {uid: 2}]);
        expect(listener1).to.have.been.calledOnce;
        expect(listener2).to.have.been.calledOnce;
    });

    it("notifies listeners when evicting", function () {
        let listener1 = sinon.spy();
        let listener2 = sinon.spy();
        one.subscribe(listener1);
        one.subscribe(listener2);
        one.put({uid: 1});
        one.evict(1);
        expect(listener1).to.have.been.calledTwice;
        expect(listener2).to.have.been.calledTwice;
    });

    it("does not notify if eviction didn't happen", function () {
        let listener1 = sinon.spy();
        let listener2 = sinon.spy();
        one.subscribe(listener1);
        one.subscribe(listener2);
        one.put({uid: 1});
        one.evict(2);
        expect(listener1).to.have.been.calledOnce;
        expect(listener2).to.have.been.calledOnce;
    });

    it("unsubscribes listener", function () {
        let listener1    = sinon.spy();
        let listener2    = sinon.spy();
        let unsubscribe1 = one.subscribe(listener1);
        let unsubscribe2 = one.subscribe(listener2);
        one.put([{uid: 1}, {uid: 2}]);
        unsubscribe2();
        unsubscribe2(); // verify it does not blow up
        one.evict(2);
        expect(listener1).to.have.been.calledTwice;
        expect(listener2).to.have.been.calledOnce;
    })

    it("notifies when changing the index", function () {
        one.put({uid: 1});
        one.put({uid: 1, text: "test"});
        let listener1 = sinon.spy();
        let listener2 = sinon.spy();
        one.subscribe(listener1);
        one.subscribe(listener2);
        one.index(0);
        expect(listener1).to.have.been.called;
        expect(listener2).to.have.been.called;
    });

    it("does not notify if index not changed", function () {
        one.put({uid: 1});
        one.put({uid: 1, text: "test"});
        let listener1 = sinon.spy();
        let listener2 = sinon.spy();
        one.subscribe(listener1);
        one.subscribe(listener2);
        one.index(1);
        expect(listener1).to.not.have.been.called;
        expect(listener2).to.not.have.been.called;
    });
});


