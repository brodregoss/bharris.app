function markdownit() {
  return {
    render(src) {
      return String(src || '');
    },
    use() {
      return this;
    },
  };
}

module.exports = markdownit;
module.exports.default = markdownit;
