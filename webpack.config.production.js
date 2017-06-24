var path = require('path')
var webpack = require('webpack')

const ROOT_PATH = path.resolve(__dirname)
const DIST_PATH = path.resolve(ROOT_PATH, 'dist')
const APP_PATH = path.resolve(ROOT_PATH, 'src')
const MAIN_PATH = path.resolve(ROOT_PATH, 'src/index.ts')

module.exports = {
  context: APP_PATH,
  entry: MAIN_PATH,
  output: {
    path: DIST_PATH,
    filename: 'one.min.js',
    include: APP_PATH,
  },
  resolve: {
    root: path.resolve(APP_PATH),
    extensions: ['', '.ts', '.js'],
  },
  module: {
    loaders: [
      {
        test: /\.ts?$/,
        loaders: ['babel-loader', 'ts-loader'],
        include: APP_PATH,
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      minimize: false,
      compress: {
        warnings: true,
      },
    }),
  ],
}
