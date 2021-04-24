const path = require('path')

module.exports = {
  context: __dirname,
  entry: "./src/index.js",
  target: 'webworker',
  resolve: {
    alias: {
      fs: path.resolve(__dirname, './null.js'),
    },
  },
  node: {net: 'empty', tls: 'empty'},
  mode: 'production',
  optimization: {
    usedExports: true,
  },
}
