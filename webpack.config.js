const path = require('path')

module.exports = {
  context: __dirname,
  entry: "./src/index.js",
  target: 'webworker',
  resolve: {
    alias: {
      fs: path.resolve(__dirname, './null.js'),
    },
    extensions: [".webpack.js", ".web.js", ".mjs", ".js", ".json"],
  },
  node: {net: 'empty', tls: 'empty'},
  mode: 'production',
  optimization: {
    usedExports: true,
  },
  module: {
    rules: [{
      test: /\.mjs$/,
      include: /node_modules/,
      type: "javascript/auto",
    }],
  },
}
