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

    describe("Thread", function () {
        it("detects dirty entity on thread", function () {
            One.put({uid: 1}, "thread1");
            let result = One.get(1);
            One.put({uid: 1, text: "test"});
            One.put({uid: 1, text: "test2"}, "thread1");
            expect(One.isDirty(result)).to.be.true;
            One.undo(); // main thread
            expect(One.isDirty(result)).to.be.true;
            expect(One.isDirty(result, "thread1")).to.be.true;
            One.undo("thread1");
            expect(One.isDirty(result)).to.be.true;
            expect(One.isDirty(result, "thread1")).to.be.false;
        });

        it("commits queue to the correct threads", function () {
            let item1 = {uid: 1};
            One.put(item1); // 0
            let item2 = {uid: 2};
            One.queue([item1, item2]); // 0
            let state = One.commit("threadId"); // 1

            let threadData = state.threads.threadId;
            expect(One.length()).to.equal(2);
            expect(One.size()).to.equal(2);
            expect(state.success).to.be.true;
            expect(threadData.length > 0).to.be.true;
            expect(One.onThread("threadId")).to.be.true;
        });

        it("gets an edit item from the correct thread", function () {
            One.put({uid: 1});
            One.put({uid: 1, text: "test"}, "thread1");
            One.put({uid: 1, text: "middle"});
            One.put({uid: 1, text: "final"}, "thread1");
            One.undo("thread1");
            let mainEdit = One.getEdit(1);
            expect(mainEdit.text).to.equal("final");
            mainEdit = One.getEdit(1, "thread1");
            expect(mainEdit.text).to.equal("test");
        });

        it("puts to thread with number id", function () {
            One.put({uid: 1, text: "test"}, 1);
            expect(One.get(1, 1)).to.not.be.undefined;
            expect(One.get(1, 1).text).to.equal("test");
        });

        it("does not replace thread if already started on thread call", function () {
            let result = One.put({uid: 1}); // current 0

            One.put({uid: 2}); // current 1

            One.put({uid: 4}, "threadId"); // current2, thread 0
            One.put({uid: 3}); // current 3, thread 0
            One.undo("threadId"); // current 3, thread 0
            expect(One.get(3)).to.not.be.undefined;
            result = One.get(3, "threadId");
            expect(One.get(3, "threadId")).to.be.undefined;
        });

        it("reads thread absent after closing thread", function () {
            let item1 = {uid: 1};
            One.put(item1, "threadId");
            let state = One.cutThread("threadId");
            expect(state.success).to.be.true;
            expect(state.threads.main.hasPrev).to.be.false;
            expect(state.threads.main.hasNext).to.be.false;
            expect(One.hasThread("threadId")).to.be.false;
            expect(One.onThread("threadId")).to.be.false;
        });

        it("removes intermediary states when closing thread", function () {
            One.put({uid: 1}); //0
            One.put({uid: 2}, "thread1"); // 1
            One.put({uid: 3}, "thread1"); // 2
            One.put({uid: 4}, "thread1"); // 3
            One.put({uid: 5}); // 4
            One.put({uid: 6}); //5
            One.put({uid: 7}, "thread1"); // 6
            One.put({uid: 8}, "thread1"); // 7
            One.put({uid: 9}); // 8
            One.put({uid: 10}, "thread1"); //9
            One.put({uid: 11}); // 10
            One.put({uid: 12}, "thread1"); // 11
            One.put({uid: 14}); // 12

            expect(One.length()).to.equal(13);
            expect(One.onThread("thread1")).to.be.false;

            let state = One.closeThread("thread1");
            expect(state.success).to.be.true;
            let main = state.threads.main;
            expect(main).to.not.be.undefined;
            expect(main.currentIndex).to.equal(7);
            expect(main.length).to.equal(8);

            // all items still on the cache in the last node
            expect(main.hasPrev).to.be.true;
            expect(main.hasNext).to.be.false;
            expect(One.get(1)).to.not.be.undefined;
            expect(One.get(2)).to.not.be.undefined; // thread edge
            expect(One.get(3)).to.not.be.undefined;
            expect(One.get(4)).to.not.be.undefined;
            expect(One.get(5)).to.not.be.undefined;
            expect(One.get(6)).to.not.be.undefined;
            expect(One.get(7)).to.not.be.undefined;
            expect(One.get(8)).to.not.be.undefined;
            expect(One.get(9)).to.not.be.undefined;
            expect(One.get(10)).to.not.be.undefined;
            expect(One.get(11)).to.not.be.undefined;
            expect(One.get(12)).to.not.be.undefined; // thread edge
            expect(One.get(14)).to.not.be.undefined;
        });

        it("removes intermediary states when closing thread but keeps other thread nodes if present", function () {
            let item1 = {uid: 1};
            One.put(item1);

            One.put({uid: 2}, "thread1");
            One.put({uid: 3}, ["thread1", "thread2"]);

            expect(One.length()).to.equal(3);
            expect(One.onThread("thread1")).to.be.true;
            One.closeThread("thread1");

            expect(One.onThread("thread1")).to.be.false;
            expect(One.length()).to.equal(3);
            expect(One.size()).to.equal(3);
            expect(One.get(1)).to.not.be.undefined;
            expect(One.get(2)).to.not.be.undefined;
            expect(One.get(3)).to.not.be.undefined;
        });

        it("removes states after current when reverting and putting new entity", function () {
            const thId = "thId"; // threadId
            One.put({uid: 2}, thId); // 0
            One.put({uid: 3}, thId); // 1
            One.put({uid: 4}, thId); // 2
            One.put({uid: 5}, thId); // 3
            let state = One.undo(thId); // threadId == 1

            expect(One.get(5, thId)).to.be.undefined;
            state = One.put({uid: 6}, thId);
            expect(state.success).to.be.true;

            // put to thread advances index
            expect(state.threads.thId.currentIndex).to.equal(3);
            expect(state.threads.thId.length).to.equal(4);
            expect(state.threads.thId.hasNext).to.be.false;
            expect(One.get(5)).to.be.undefined;
        });

        it("keeps states that are on another thread when reverting and putting new entity", function () {
            const thId = "thId"; // threadId
            const th2 = "th2";
            One.put({uid: 2}, thId); // 0
            One.put({uid: 3}, thId); // 1
            One.put({uid: 4}, thId); // 2
            One.put({uid: 5}, [thId, th2]); // 3
            let state = One.undo(thId); // threadId == 1
            expect(One.get(5, thId)).to.be.undefined;
            state = One.put({uid: 6}, thId);
            expect(state.success).to.be.true;
            expect(state.threads.thId.currentIndex).to.equal(3);
            // the intermediary state is still removed from this thread
            expect(state.threads.thId.length).to.equal(4);
            expect(state.threads.thId.hasNext).to.be.false;
            expect(One.get(5)).to.not.be.undefined;
            expect(state.threads.th2.currentIndex).to.equal(0);
            expect(state.threads.th2.hasNext).to.be.false;
        });

        it("throws on wrong type of thread id", function () {
            expect(() => {
                One.put({uid: 1}, {})
            }).to.throw(Error);
        });

        it("throws on merging with no thread id", function () {
            expect(() => {
                One.mergeThread()
            }).to.throw(Error);
        });

        it("keeps all intermediary states on mergeThread", function () {
            let threadId = "thread1";
            One.put({uid: 1}, threadId);
            One.put({uid: 2}, threadId);
            One.put({uid: 3}, threadId);
            let result = One.mergeThread(threadId);
            expect(One.length()).to.equal(3);
            expect(One.get(1, threadId)).to.be.undefined;
            expect(One.get(1)).to.not.be.undefined;
            let threads = One.listThreads();
            expect(threads.length).to.equal(1);
            expect(threads[0]).to.equal("main");
        });

        it("puts cache nodes on target thread if supplied on mergeThread", function () {
            let threadId       = "thread1";
            let targetThreadId = "thread2";
            One.put({uid: 1}, threadId);
            One.put({uid: 2}, threadId);
            One.put({uid: 3}, threadId);
            let result = One.mergeThread(threadId, targetThreadId);
            expect(result.threads.thread2).to.not.be.undefined;
            expect(result.threads.thread2.length).to.equal(3);
            expect(result.threads.thread2.hasPrev).to.be.true;
            expect(result.threads.thread2.hasNext).to.be.false;
            expect(One.get(1, "thread1")).to.be.undefined;
            expect(One.get(1, "thread2")).to.not.be.undefined;
            expect(One.get(1)).to.not.be.undefined;
        });

        it("puts cache nodes on target thread if supplied on closeThread", function () {
            let threadId       = "thread1";
            let targetThreadId = "thread2";
            One.put({uid: 1}, threadId);
            One.put({uid: 2}, threadId);
            One.put({uid: 3}, threadId);
            let result = One.closeThread(threadId, targetThreadId);
            expect(result.threads.thread2).to.not.be.undefined;
            expect(result.threads.thread2.length).to.equal(2);
            expect(result.threads.thread2.currentIndex).to.equal(1);
            expect(result.threads.thread2.hasPrev).to.be.true;
            expect(result.threads.thread2.hasNext).to.be.false;
            expect(One.length()).to.equal(2);

            expect(One.get(1, "thread1")).to.be.undefined;
            expect(One.get(1, "thread2")).to.not.be.undefined;
            expect(One.get(1)).to.not.be.undefined;

            expect(One.get(2, "thread1")).to.be.undefined;
            expect(One.get(2, "thread2")).to.not.be.undefined;
            expect(One.get(2)).to.not.be.undefined;

            expect(One.get(3, "thread1")).to.be.undefined;
            expect(One.get(3, "thread2")).to.not.be.undefined;
            expect(One.get(3)).to.not.be.undefined;
        });

        it("cancels thread", function () {
            One.put({uid: 1});
            ;
            One.put({uid: 2});
            One.put({uid: 3});
            One.cutThread();

            // no item was actually put on the thread
            expect(One.length()).to.equal(3);
            expect(One.size()).to.equal(3);
            expect(One.get(1)).to.not.be.undefined;
        });

        it("reads within thread when undoing", function () {
            let item1 = {uid: 1};
            One.put(item1); // current 0
            One.put({uid: 1, text: "test0"}); // current 1
            let threadId = "threadId";

            One.put({uid: 1, text: "test1"}, threadId); // current 2
            One.put({uid: 2}); // current 3
            One.put({uid: 1, text: "test2"}, threadId); // current 4

            // undo to next thread node: undo(true)
            let result = One.undo(threadId); // current 2

            expect(result.success).to.be.true;
            expect(result.threads.threadId.hasPrev).to.be.false;
            expect(result.threads.threadId.hasNext).to.be.true;

            // main and thread travel separately
            expect(One.get(1).text).to.equal("test2");
            expect(result.threads.main.currentIndex).to.equal(4);

            result = One.undo(); // current 3
            expect(result.success).to.be.true;
            expect(result.threads.main.hasPrev).to.be.true;
            expect(result.threads.main.currentIndex).to.equal(3);
            expect(One.get(1).text).to.equal("test1");

            result = One.undo(); // current 2
            result = One.undo(); // current 1
            result = One.undo(); // current 0
            expect(result.success).to.be.true;
            expect(result.threads.main.currentIndex).to.equal(0);
            expect(One.get(1).text).to.be.undefined;

            // check keeps end nodes from this thread after undo on main thread
            // thread went back one step - keep current index but delete thread last index
            result = One.closeThread(threadId);

            expect(result.success).to.be.true;
            expect(result.threads.threadId).to.be.undefined; // thread was closed
            expect(One.length()).to.equal(4); // closed the thread = keeps ends
        });

        it("throws when closing thread with missing id", function () {
            expect(() => {
                One.closeThread()
            }).to.throw(Error);
        });

        it("maintains correct current index when committing thread with intermediary items", function () {
            // thread open and items have been added both in thread and outside of it
            // some undo was performed but not to revert thread completely
            // keep thread intermediary nodes - all between start node and current last node
            One.put({uid: 1}); // current 0
            let threadId = "threadId"; // current 0
            One.put({uid: 1, text: "1"}, threadId); // current 1
            One.put({uid: 2}); // current 2
            One.put({uid: 1, text: "3"}, threadId); // current 3
            One.put({uid: 3}); // current 4
            One.put({uid: 1, text: "5"}, threadId); // current 5
            One.undo(threadId); // current 3 / total 5
            let state = One.mergeThread(threadId); // current 4
            expect(One.getCurrentIndex()).to.equal(4);
            // keeps the one non thread state AFTER the last thread node
            expect(One.length()).to.equal(5);

            let threads = One.listThreads();
            expect(threads.indexOf("threadId")).to.equal(-1);
        });

        it("maintains correct current index when committing thread clean", function () {
            // commit thread clean = remove all thread nodes except start and finish nodes
            // thread open and items have been added both in thread and outside of it
            // some undo was performed but not to revert thread completely
            One.put({uid: 1}); // current 0
            let threadId = "threadId"; // current 0
            One.put({uid: 1, text: "1"}, threadId); // current 1
            One.put({uid: 2}); // current 2
            One.put({uid: 1, text: "3"}, threadId); // current 3
            One.put({uid: 3}); // current 4
            One.put({uid: 1, text: "5"}, threadId); // current 5
            let state = One.undo(threadId); // current 3 / total 5

            // thread went one step back + commits clean
            state = One.closeThread(threadId); // current 4

            expect(state.success).to.be.true;
            expect(state.threads.main.currentIndex).to.equal(4);
            expect(state.threads.main.length).to.equal(5);

            state = One.undo(); // 3
            expect(One.get(1).text).to.equal("3");
            expect(One.getCurrentIndex()).to.equal(3);
            expect(One.length()).to.equal(5);

            One.undo(); //2
            expect(One.get(1).text).to.equal("1");
        });

        it("cancels thread on cutThread", function () {
            One.put({uid: 1});
            One.put({uid: 2}, "threadId");

            let state = One.cutThread("threadId");
            expect(state.success).to.be.true;
            expect(state.threads.main.currentIndex).to.equal(0);
            expect(state.threads.threadId).to.be.undefined;

            expect(One.length()).to.equal(1);
            expect(One.get(2)).to.be.undefined;
            expect(One.getCurrentIndex()).to.equal(0);
            expect(One.get(1)).to.not.be.undefined;
        });

        it("keeps other threads on cutThread", function () {
            One.put({uid: 1});
            One.put({uid: 2}, "th1");
            One.put({uid: 3}, ["th1", "th2"]);
            let state = One.cutThread("th1");
            expect(state.success).to.be.true;
            expect(state.threads.th1).to.be.undefined;
            expect(state.threads.th2).to.not.be.undefined;
            expect(state.threads.th2.currentIndex).to.equal(0);
            expect(state.threads.th2.length).to.equal(1);

        });

        it("maintains correct current index when cancelling thread with intermediary items", function () {
            // thread open and items have been added both in thread and outside of it
            // some undo was performed but not to revert thread completely
            One.put({uid: 1}); // current 0
            let threadId = "threadId"; // current 0
            One.put({uid: 1, text: "1"}, threadId); // current 1
            One.put({uid: 2}); // current 2 / 1 after closeGap
            One.put({uid: 1, text: "3"}, threadId); // current 3
            One.put({uid: 3}); // current 4 / 2 after closeGap
            One.put({uid: 1, text: "5"}, threadId); // current 5
            One.undo(threadId); // current 3 / total 5
            let state = One.cutThread(); // no op - missing threadId
            expect(state.success).to.be.false;

            state = One.cutThread(threadId); // current 4
            expect(One.getCurrentIndex()).to.equal(2);
        });

        //it("puts deep nested to thread = does not add on weak", function () {
        //    let tr        = {uid: 1, page: []};
        //    let cacheList = {uid: 2, transfer: tr};
        //    One.put(cacheList);
        //    let tr2           = {
        //        uid : 1,
        //        page: [
        //            {uid: 3},
        //            {uid: 4},
        //            {uid: 5}
        //        ]
        //    };
        //    let editable      = One.getEdit(2);
        //    editable.transfer = tr2;
        //    let historyState  = One.put(editable, "thread1", false);
        //    expect(One.size()).to.equal(2);
        //});

        it("puts deep nested to thread = does add on strong", function () {
            let tr        = {uid: 1, page: []};
            let cacheList = {uid: 2, transfer: tr};
            One.put(cacheList);
            let tr2           = {
                uid : 1,
                page: [
                    {uid: 3},
                    {uid: 4},
                    {uid: 5}
                ]
            };
            let editable      = One.getEdit(2);
            editable.transfer = tr2;
            let historyState  = One.put(editable, "thread1");
            expect(One.size()).to.equal(5);
        });

        it("does not cut main thread", function () {
            One.put({uid: 1});
            expect(()=> {
                One.cutThread("main")
            }).to.throw(TypeError);
        });

        it("returns false on non existing thread", function () {
            expect(One.cutThread().success).to.be.false;
        });

        it("returns false for non existing thread", function () {
            expect(One.cutThread(69).success).to.be.false; // how sad
        });

        it("doesn't commit main thread", function () {
            expect(() => {
                One.closeThread("main")
            }).to.throw(TypeError);
        });

        it("fails silently on non existing thread", function () {
            expect(() => One.closeThread(123)).to.not.throw(Error);
        });

        it("reads dirty on thread", function () {
            let item1 = {uid: 1};
            One.put(item1, 1);
            expect(One.isDirty(item1, 1)).to.be.false;
            expect(One.isDirty({uid: 1}, 1)).to.be.true;
        });
    });
});


