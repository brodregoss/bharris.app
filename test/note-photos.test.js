import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileList, validateNotePhotos } from '../src/lib/imageData.js';

function liveList(file) {
  const list = {
    0: file,
    length: 1,
    *[Symbol.iterator]() {
      if (this.length) yield this[0];
    },
  };
  return list;
}

test('the chosen photo survives clearing the live picker list', () => {
  const file = { type: '', name: 'IMG_2048.HEIC', size: 1200 };
  const list = liveList(file);
  const kept = copyFileList(list);
  list.length = 0;
  const checked = validateNotePhotos(kept);
  assert.equal(checked.error, undefined);
  assert.deepEqual(checked.files, [file]);
  assert.equal(validateNotePhotos(list).error, 'Please choose a photo of your notes.');
});

test('a phone photo with no mime type still counts', () => {
  const file = { type: 'application/octet-stream', name: 'notes.jpg', size: 10 };
  assert.equal(validateNotePhotos([file]).error, undefined);
});

test('a pdf is not a notes photo', () => {
  const file = { type: 'application/pdf', name: 'notes.pdf', size: 10 };
  assert.equal(validateNotePhotos([file]).error, 'Please choose photos of your notes.');
});
