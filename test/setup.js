// from: http://reactjsnews.com/testing-in-react/
require("babel-core/register")({
    stage: 0
});

var jsdom = require('node-jsdom');

// setup the simplest document possible
var doc = jsdom.jsdom('<!doctype html><html><body></body></html>');

// get the window object out of the document
var win = doc.defaultView;

// set globals for mocha that make access to document and window feel
// natural in the test environment
global.document = doc;
global.window   = win;

// take all properties of the window object and also attach it to the
// mocha global object
propagateToGlobal(win);

// from mocha-jsdom https://github.com/rstacruz/mocha-jsdom/blob/master/index.js#L80
function propagateToGlobal(window) {
    'use strict';
    for (let key in window) {
        if (!window.hasOwnProperty(key)) continue
        if (key in global) continue
        global[key] = window[key]
    }
}