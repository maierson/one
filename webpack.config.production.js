var path    = require('path');
var webpack = require('webpack');
var merge   = require('webpack-merge');

var TARGET            = process.env.npm_lifecycle_event;
process.env.BABEL_ENV = TARGET;

const ROOT_PATH  = path.resolve(__dirname);
const DIST_PATH = path.resolve(ROOT_PATH, "dist");
const APP_PATH   = path.resolve(ROOT_PATH, "src");
const MAIN_PATH  = path.resolve(ROOT_PATH, "src/index.js");

module.exports = {
    context: APP_PATH,
    entry  : MAIN_PATH,
    output : {
        path    : DIST_PATH,
        filename: "one.min.js",
        include : APP_PATH
    },
    resolve: {
        root      : path.resolve(APP_PATH),
        extensions: ['', '.js', '.jsx']
    },
    module : {
        loaders: [
            {
                test   : /\.jsx?$/,
                loaders: ['babel'],
                include: APP_PATH,
                exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            minimize: false,
            compress:{
                warnings:true
            }
        })
    ]
};
