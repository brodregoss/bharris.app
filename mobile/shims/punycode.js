'use strict';

// Minimal punycode stand-in so markdown-it can bundle in Metro.
// Panic notes don't need IDNA encoding.
function identity(value) {
  return String(value);
}

module.exports = {
  version: '2.3.1',
  ucs2: {
    decode(string) {
      return Array.from(String(string), (char) => char.codePointAt(0));
    },
    encode(codePoints) {
      return String.fromCodePoint(...codePoints);
    },
  },
  decode: identity,
  encode: identity,
  toASCII: identity,
  toUnicode: identity,
};
