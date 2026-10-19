import test from 'node:test';
import assert from 'node:assert/strict';
import {tabDestination} from '../src/settings-tabs';

test('settings tabs wrap at either edge', () => {
  assert.equal(tabDestination('ArrowRight', 2, 3), 0);
  assert.equal(tabDestination('ArrowLeft', 0, 3), 2);
  assert.equal(tabDestination('ArrowRight', 0, 3), 1);
  assert.equal(tabDestination('ArrowLeft', 2, 3), 1);
});
test('settings tabs support Home and End without consuming other shortcuts', () => {
  assert.equal(tabDestination('Home', 1, 3), 0);
  assert.equal(tabDestination('End', 1, 3), 2);
  for (const key of [' ', 'Enter', 'ArrowDown', 'f']) {
    assert.equal(tabDestination(key, 1, 3), undefined);
  }
});
test('empty and single-item tab lists are safe', () => {
  assert.equal(tabDestination('Home', 0, 0), undefined);
  assert.equal(tabDestination('ArrowLeft', 0, 1), 0);
  assert.equal(tabDestination('ArrowRight', 0, 1), 0);
});
