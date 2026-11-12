// JSON file store with atomic writes (write tmp + rename). No native modules.
import fs from 'node:fs';
import path from 'node:path';
export function createStore(file, seedFn) {
  let data = null;
  function load() {
    if (data) return data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { data = seedFn(); save(); }
    return data;
  }
  function save() {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  }
  return {
    get: load,
    save,
    reset() { data = seedFn(); save(); return data; },
  };
}
export function memoryStore(seedFn) {
  let data = seedFn();
  return { get: () => data, save() {}, reset() { data = seedFn(); return data; } };
}
