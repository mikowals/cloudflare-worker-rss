const path = require('path')
module.exports = {
  context: __dirname,
  entry: "./src/index.ts",
  target: "webworker",
  output: {
    filename: 'worker.js',
    path: path.join(__dirname, 'dist'),
  },
  resolve: {
    alias: {
      fs: path.resolve(__dirname, './null.js'),
      browser: path.resolve(__dirname, './null.js'),
    },
    extensions: ['.webpack.js', 'web.js', '.mjs', '.ts', '.tsx', '.js'],
  },
  node: {
    tls: 'empty', 
    net: 'empty'
  },
  mode: 'production',
  optimization: {
    usedExports: true,
  },

  devtool: 'cheap-module-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        type: 'javascript/auto',
        test: /\.mjs$/,
        include: /node_modules/,
        use: []
      }
    ],
  },
}
