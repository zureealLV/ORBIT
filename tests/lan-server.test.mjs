import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const privateIPv4 = address => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address);
const lanAddress = Object.values(networkInterfaces()).flat().find(item => item.family === 'IPv4' && !item.internal && privateIPv4(item.address))?.address;
const request = (port, host, pathname = '/api/health', headers = {}, hostname = '127.0.0.1') => new Promise((resolve, reject) => {
  const req = http.get({ hostname, port, path: pathname, headers: { Host: host, ...headers } }, res => {
    let body = ''; res.setEncoding('utf8'); res.on('data', chunk => body += chunk);
    res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
  });
  req.setTimeout(2000, () => req.destroy(new Error('Request timed out'))); req.on('error', reject);
});
async function withServer(lan, run) {
  const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['server/index.mjs', '--production', ...(lan ? ['--lan'] : [])], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: String(port) }, stdio: 'pipe', windowsHide: true
  });
  let output = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk);
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try { ready = (await request(port, `127.0.0.1:${port}`)).status === 200; } catch {}
      if (ready) break;
      if (child.exitCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Server did not start: ${output}`);
    await run(port);
  } finally {
    if (child.exitCode === null) { const done = once(child, 'exit'); child.kill(); await done; }
  }
}

test('LAN mode listens on a private IPv4 interface and serves same-origin APIs', {skip: !lanAddress}, async () => {
  assert.ok(lanAddress, 'A private IPv4 interface is required for the LAN integration test');
  await withServer(true, async port => {
    const host = `${lanAddress}:${port}`;
    const health = await request(port, host, '/api/health', {}, lanAddress);
    assert.equal(health.status, 200); assert.equal(JSON.parse(health.body).accessMode, 'lan');
    assert.equal((await request(port, host, '/api/beatmaps/738063/progress', { Origin: `http://${host}` })).status, 200);
  });
});

test('default mode stays loopback-only and advertises no LAN URLs', async () => {
  await withServer(false, async port => {
    const health = await request(port, `127.0.0.1:${port}`);
    assert.equal(JSON.parse(health.body).accessMode, 'local');
    assert.deepEqual(JSON.parse(health.body).lanUrls, []);
    assert.equal((await request(port, `${lanAddress ?? '10.253.254.252'}:${port}`)).status, 403);
  });
});

test('LAN mode still rejects arbitrary Host headers and cross-origin API requests', async () => {
  await withServer(true, async port => {
    const host = `127.0.0.1:${port}`, api = '/api/beatmaps/738063/progress';
    for (const badHost of [`evil.example:${port}`, `8.8.8.8:${port}`, `10.253.254.252:${port}`, `localhost:${port + 1}`]) {
      assert.equal((await request(port, badHost)).status, 403);
    }
    for (const origin of ['https://evil.example', 'null', `http://localhost:${port}`, `https://${host}`]) {
      assert.equal((await request(port, host, api, { Origin: origin })).status, 403);
    }
    assert.equal((await request(port, host, api, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await request(port, host, api, { Origin: `http://${host}`, 'Sec-Fetch-Site': 'same-origin' })).status, 200);
    assert.equal((await request(port, host, api)).headers['access-control-allow-origin'], undefined);
  });
});
