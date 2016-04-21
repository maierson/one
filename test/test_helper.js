import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);

let { assert, expect } = chai;

function contains(array, needle) {
    // Per spec, the way to identify NaN is that it is not equal to itself
    var findNaN = needle !== needle;
    var indexOf;

    if (!findNaN && typeof Array.prototype.indexOf === 'function') {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (needle) {
            var i = -1, index = -1;

            for (i = 0; i < this.length; i++) {
                var item = this[i];

                if ((findNaN && item !== item) || item === needle) {
                    index = i;
                    break;
                }
            }

            return index;
        };
    }
    return indexOf.call(array, needle) > -1;
};

function print(obj, message) {
    if (message === undefined) {
        message = "";
    }
    console.log(message + JSON.stringify(obj, null, 2));
}

export {
    chai,
    sinon,
    assert,
    expect,
    contains,
    print
}
