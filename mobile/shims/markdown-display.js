const React = require('react');
const { Text } = require('react-native');

function Markdown({ children }) {
  return React.createElement(Text, null, children == null ? '' : String(children));
}

module.exports = Markdown;
module.exports.default = Markdown;
