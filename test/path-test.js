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
import {deepClone, isArray} from '../src/utils/clone';
import * as objectPath from "../src/utils/path";
import {describe, it} from 'mocha/lib/mocha.js';

describe("Path", function () {

    "use strict";

    function getTestObj() {
        return {
            a: 'b',
            b: {
                c: [],
                d: ['a', 'b'],
                e: [{}, {f: 'g'}],
                f: 'i'
            }
        };
    }

    describe("get", function () {
        it('should return the value under shallow object', function () {
            var obj = getTestObj();
            expect(objectPath.get(obj, 'a')).to.be.equal('b');
            expect(objectPath.get(obj, ['a'])).to.be.equal('b');
        });

        it('should work with number path', function () {
            var obj = getTestObj();
            expect(objectPath.get(obj.b.d, 0)).to.be.equal('a');
            expect(objectPath.get(obj.b, 0)).to.be.equal(void 0);
        });

        it('should return the value under deep object', function () {
            var obj = getTestObj();
            expect(objectPath.get(obj, 'b.f')).to.be.equal('i');
            expect(objectPath.get(obj, ['b', 'f'])).to.be.equal('i');
        });

        it('should return the value under array', function () {
            var obj = getTestObj();
            expect(objectPath.get(obj, 'b.d.0')).to.be.equal('a');
            expect(objectPath.get(obj, ['b', 'd', 0])).to.be.equal('a');
        });

        it('should return the value under array deep', function () {
            var obj = getTestObj();
            expect(objectPath.get(obj, 'b.e.1.f')).to.be.equal('g');
            expect(objectPath.get(obj, ['b', 'e', 1, 'f'])).to.be.equal('g');
        });

        it('should return undefined for missing values under object', function () {
            var obj = getTestObj();
            expect(objectPath.get(obj, 'a.b')).to.not.exist;
            expect(objectPath.get(obj, ['a', 'b'])).to.not.exist;
        });

        it('should return undefined for missing values under array', function () {
            var obj = getTestObj();
            expect(objectPath.get(obj, 'b.d.5')).to.not.exist;
            expect(objectPath.get(obj, ['b', 'd', '5'])).to.not.exist;
        });

        it('should return the value under integer-like key', function () {
            var obj = {'1a': 'foo'};
            expect(objectPath.get(obj, '1a')).to.be.equal('foo');
            expect(objectPath.get(obj, ['1a'])).to.be.equal('foo');
        });

        it('should return the default value when the key doesnt exist', function () {
            var obj = {'1a': 'foo'};
            expect(objectPath.get(obj, '1b', null)).to.be.equal(null);
            expect(objectPath.get(obj, ['1b'], null)).to.be.equal(null);
        });

        it('should return the default value when path is empty', function () {
            var obj = {'1a': 'foo'};
            expect(objectPath.get(obj, '', null)).to.be.deep.equal({'1a': 'foo'});
            expect(objectPath.get(obj, [])).to.be.deep.equal({'1a': 'foo'});
            expect(objectPath.get({}, ['1'])).to.be.equal(undefined);
        });

        it('should skip non own properties with isEmpty', function () {
            var Base           = function (enabled) {
            };
            Base.prototype     = {
                one: {
                    two: true
                }
            };
            var Extended       = function () {
                Base.call(this, true);
            };
            Extended.prototype = Object.create(Base.prototype);

            var extended = new Extended();

            expect(objectPath.get(extended, ['one', 'two'])).to.be.equal(undefined);
            extended.enabled = true;

            expect(objectPath.get(extended, 'enabled')).to.be.equal(true);
        });
    });

    describe('del', function () {
        it('should return undefined on empty object', function () {
            expect(objectPath.del({}, 'a')).to.equal(void 0);
        });

        it('should work with number path', function () {
            var obj = getTestObj();
            objectPath.del(obj.b.d, 1);
            expect(obj.b.d).to.deep.equal(['a']);
        });

        it('should delete deep paths', function () {
            var obj = getTestObj();

            expect(objectPath.del(obj)).to.be.equal(obj);



            obj = {
                a: 'b',
                b: {
                    c: [],
                    d: ['a', 'b'],
                    e: [{}, {f: 'g'}],
                    f: 'i'
                }
            };

            let g = [[],["test", "test"]];
            let h = {az:"test"};
            obj.b.g = g;
            obj.b.h = h;

            expect(obj).to.have.deep.property('b.g.1.0', 'test');
            expect(obj).to.have.deep.property('b.g.1.1', 'test');
            expect(obj).to.have.deep.property('b.h.az', 'test');

            objectPath.del(obj, 'b.h.az');
            expect(obj).to.not.have.deep.property('b.h.az');
            expect(obj).to.have.deep.property('b.h');

            objectPath.del(obj, 'b.g.1.1');
            expect(obj).to.not.have.deep.property('b.g.1.1');
            expect(obj).to.have.deep.property('b.g.1.0', 'test');

            objectPath.del(obj, ['b', 'g', '1', '0']);
            expect(obj).to.not.have.deep.property('b.g.1.0');
            expect(obj).to.have.deep.property('b.g.1');

            expect(objectPath.del(obj, ['b'])).to.not.have.deep.property('b.g');
            expect(obj).to.be.deep.equal({'a': 'b'});
        });

        it('should remove items from existing array', function () {
            var obj = getTestObj();

            objectPath.del(obj, 'b.d.0');
            expect(obj.b.d).to.have.length(1);
            expect(obj.b.d).to.be.deep.equal(['b']);

            objectPath.del(obj, 'b.d.0');
            expect(obj.b.d).to.have.length(0);
            expect(obj.b.d).to.be.deep.equal([]);
        });

        it('should skip undefined paths', function () {
            var obj = getTestObj();

            expect(objectPath.del(obj, 'do.not.exist')).to.be.equal(obj);
            expect(objectPath.del(obj, 'a.c')).to.be.equal('b');
        });
    });
});


