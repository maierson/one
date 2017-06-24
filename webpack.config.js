var path = require('path')

const ROOT_PATH = path.resolve(__dirname)
const DIST_PATH = path.resolve(ROOT_PATH, 'dist')
const APP_PATH = path.resolve(ROOT_PATH, 'src')
const MAIN_PATH = path.resolve(ROOT_PATH, 'src/index.ts')

module.exports = {
  devtool: 'inline-source-map',
  context: APP_PATH,
  entry: MAIN_PATH,
  output: {
    path: DIST_PATH,
    filename: 'one.js',
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
}
