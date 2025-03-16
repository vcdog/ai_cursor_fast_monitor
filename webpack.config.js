//@ts-check

'use strict';

const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node',
  mode: 'production',
  entry: './src/extension.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'nosources-source-map',
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  optimization: {
    minimizer: [new TerserPlugin({
      terserOptions: {
        compress: {
          drop_console: false,
        },
      },
    })],
  },
  performance: {
    hints: false
  }
};

module.exports = config; 