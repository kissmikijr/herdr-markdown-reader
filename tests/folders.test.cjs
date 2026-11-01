const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Inject the two Herdr APIs so the real listing code can run outside Herdr.
// The subprocesses and temporary directories below are real.
const source = fs.readFileSync(path.join(__dirname, '../mods/markdown-reader/files.js'), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
const load = new Function('exec', 'window', 'isMarkdown', source + '\nreturn { listFolder };');
const isMarkdown = value => /\.(md|markdown|mdown|mkd|mdx)$/i.test(value);
const platform = process.env.READER_TEST_SH ? 'linux' : process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
const exec = async (command, args, options = {}) => {
  if (command === 'sh' && process.env.READER_TEST_SH) {
    command = process.env.READER_TEST_SH;
    if (path.basename(command).toLowerCase() === 'busybox.exe') args = ['sh', ...args];
  }
  const result = spawnSync(command, args, { cwd: options.cwd, encoding: 'utf8' });
  return { code: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '' };
};
const { listFolder } = load(exec, () => ({ platform }), isMarkdown);
function fixture(t) {
  // Spaces, quotes, dollar signs, and leading dashes must never become code.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader space ' $ -"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('lists Markdown and folders, including hidden and unusual names', async t => {
  const root = fixture(t);
  const files = ['README.md', '.hidden.md', '..notes.md', "a ' quote $.md", '-dash.MD', 'notes.markdown', 'ignore.txt'];
  if (process.platform !== 'win32') files.push('line\nbreak.md', 'back\\slash.md', 'literal`echo injected`.md');
  for (const name of files) fs.writeFileSync(path.join(root, name), '# test');
  for (const name of ['folder space', '.hidden-folder', '..double-hidden']) fs.mkdirSync(path.join(root, name));
  fs.writeFileSync(path.join(root, 'folder space', 'nested.md'), '# should not recurse');
  if (process.platform !== 'win32') {
    fs.symlinkSync('README.md', path.join(root, 'linked.md'));
    fs.symlinkSync('folder space', path.join(root, 'linked-folder'));
    fs.symlinkSync('missing', path.join(root, 'broken.md'));
  }
  const actual = await listFolder(root, null);
  const expected = [...files.filter(isMarkdown).map(name => ({ path: name, dir: false })),
    ...['folder space', '.hidden-folder', '..double-hidden'].map(name => ({ path: name, dir: true }))];
  const sort = list => list.sort((a, b) => a.path.localeCompare(b.path));
  assert.deepEqual(sort(actual), sort(expected));
});

test('empty directories return no literal glob patterns', async t => {
  assert.deepEqual(await listFolder(fixture(t), null), []);
});

test('limits folder listing to 1,000 entries', async t => {
  const root = fixture(t);
  for (let i = 0; i < 1005; i++) fs.writeFileSync(path.join(root, `${i}.md`), '');
  assert.equal((await listFolder(root, null)).length, 1000);
});

test('reports a directory listing failure', async () => {
  const failing = load(async () => ({ code: 1, stdout: '', stderr: 'permission denied' }), () => ({ platform: 'macos' }), isMarkdown);
  await assert.rejects(failing.listFolder('/missing', null), /Cannot list this folder/);
});

test('passes directory and remote machine as data, never shell source', async () => {
  let called;
  const remote = load(async (...args) => { called = args; return { code: 0, stdout: 'd\0folder\0f\0README.md\0f\0ignored.txt\0' }; },
    () => ({ platform: 'windows' }), isMarkdown);
  const dir = "/tmp/quote ' $(touch injected); space";
  assert.deepEqual(await remote.listFolder(dir, 'remote-mac'), [{ path: 'folder', dir: true }, { path: 'README.md', dir: false }]);
  assert.equal(called[0], 'sh');
  assert.equal(called[1][0], '-c');
  assert.ok(!called[1][1].includes(dir));
  assert.deepEqual(called[2], { cwd: dir, on: 'remote-mac' });
});
