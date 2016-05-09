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

describe("Notify", function () {

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
    });

    it("notifies when changing the index", function () {
        One.put({uid: 1});
        One.put({uid: 1, text: "test"});
        let listener1 = sinon.spy();
        let listener2 = sinon.spy();
        One.subscribe(listener1);
        One.subscribe(listener2);
        One.index(0);
        expect(listener1).to.have.been.called;
        expect(listener2).to.have.been.called;
    });

    it("does not notify if index not changed", function () {
        One.put({uid: 1});
        One.put({uid: 1, text: "test"});
        let listener1 = sinon.spy();
        let listener2 = sinon.spy();
        One.subscribe(listener1);
        One.subscribe(listener2);
        One.index(1);
        expect(listener1).to.not.have.been.called;
        expect(listener2).to.not.have.been.called;
    });
});


