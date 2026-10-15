import test from 'node:test';
import assert from 'node:assert/strict';

test('dashboard renders safely with only a minimal DOM and local storage', async () => {
  const root = {
    innerHTML: '',
    listeners: {},
    addEventListener(name, fn) { this.listeners[name] = fn; }
  };
  const cache = new Map();
  globalThis.document = { getElementById(id) { return id === 'app' ? root : null; } };
  globalThis.localStorage = {
    getItem(k) { return cache.get(k) ?? null; },
    setItem(k,v) { cache.set(k,v); }
  };
  await import('../src/app.mjs');
  assert.match(root.innerHTML, /Панель диспетчера/);
  assert.match(root.innerHTML, /LD-1042/);
  assert.match(root.innerHTML, /Только демонстрационные данные/);
  assert.ok(root.listeners.click && root.listeners.submit && root.listeners.change);
  delete globalThis.document;
  delete globalThis.localStorage;
});
