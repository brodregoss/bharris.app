const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const punycodePath = path.resolve(__dirname, 'shims/punycode.js');

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  punycode: punycodePath,
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'punycode' || moduleName === 'punycode/') {
    return { type: 'sourceFile', filePath: punycodePath };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
