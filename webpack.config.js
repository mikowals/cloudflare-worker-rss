const path = require('path')

module.exports = {
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
