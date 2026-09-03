const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { resolve } = require('metro-resolver');

const config = getDefaultConfig(__dirname);
const punycodePath = path.resolve(__dirname, 'shims/punycode.js');
const markdownDisplayStub = path.resolve(__dirname, 'shims/markdown-display.js');
const markdownItStub = path.resolve(__dirname, 'shims/markdown-it.js');

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  punycode: punycodePath,
  'react-native-markdown-display': markdownDisplayStub,
  'markdown-it': markdownItStub,
};

// Use metro-resolver.resolve (not context.resolveRequest) so this never recurses
// and Expo Go / a stale markdown-it copy cannot crash the bundle.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'punycode' || moduleName === 'punycode/') {
    return { type: 'sourceFile', filePath: punycodePath };
  }
  if (moduleName === 'react-native-markdown-display') {
    return { type: 'sourceFile', filePath: markdownDisplayStub };
  }
  if (moduleName === 'markdown-it' || moduleName.startsWith('markdown-it/')) {
    return { type: 'sourceFile', filePath: markdownItStub };
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
