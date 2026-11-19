const babelJest = require('babel-jest').default;

module.exports = babelJest.createTransformer({
  babelrc: false,
  configFile: false,
  presets: [[require.resolve('babel-preset-react-app'), { runtime: 'automatic' }]],
  plugins: [require.resolve('@babel/plugin-transform-class-static-block')],
});
