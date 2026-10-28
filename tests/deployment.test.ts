import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeployment } from '../src/deployment.ts';

test('subpath deployment keeps APIs and shared previews inside the app namespace', () => {
  const config = createDeployment('/orbit/', '/api/orbit/', false);
  assert.equal(config.appBase, '/orbit/');
  assert.equal(config.api('search?q=738063'), '/api/orbit/search?q=738063');
  assert.equal(config.share('https://zureeallv.com', 'id=738063'), 'https://zureeallv.com/orbit/?id=738063');
  assert.equal(config.share('https://zureeallv.com', new URLSearchParams({id:'738063'})), 'https://zureeallv.com/orbit/?id=738063');
  assert.equal(config.pollProgress, false);
  assert.equal(createDeployment().api('search?q=1'), '/api/search?q=1');
});

test('loaded and local map history stays under the configured app base', () => {
  const config = createDeployment('/orbit/', '/api/orbit/');
  assert.equal(config.page(new URLSearchParams({b:'738063'})), '/orbit/?b=738063');
  assert.equal(config.page(new URLSearchParams()), '/orbit/');
  assert.equal(createDeployment().page('b=738063'), '/?b=738063');
});
