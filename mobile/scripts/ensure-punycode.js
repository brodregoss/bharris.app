const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const shim = fs.readFileSync(path.join(root, 'shims', 'punycode.js'));
const pkg = `${JSON.stringify({ name: 'punycode', version: '2.3.1', main: 'index.js' }, null, 2)}\n`;

function writePunycode(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.js'), shim);
  fs.writeFileSync(path.join(dir, 'punycode.js'), shim);
  fs.writeFileSync(path.join(dir, 'package.json'), pkg);
}

writePunycode(path.join(root, 'node_modules', 'punycode'));

const markdownIt = path.join(root, 'node_modules', 'markdown-it');
if (fs.existsSync(markdownIt)) {
  writePunycode(path.join(markdownIt, 'node_modules', 'punycode'));
}

console.log('punycode shim installed for Metro');
