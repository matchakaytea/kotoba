import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  extractJson,
  findClaude,
  readResult,
  runClaude,
  type ClaudeCommand,
} from './generate';

const fake: ClaudeCommand = {
  command: process.execPath,
  args: [path.resolve('src/main/__fixtures__/fake-claude.mjs')],
  shell: false,
};

afterEach(() => {
  delete process.env.FAKE_CLAUDE_MODE;
});

describe('extractJson', () => {
  it.each([
    ['plain JSON', '{"a": 1}', '{"a": 1}'],
    ['a fenced block', '```json\n{"a": 1}\n```', '{"a": 1}'],
    [
      'text around it',
      'Here you go:\n{"a": {"b": 2}}\nEnjoy!',
      '{"a": {"b": 2}}',
    ],
  ])('handles %s', (_name, input, output) => {
    expect(extractJson(input)).toBe(output);
  });

  it('returns the text unchanged when there is no object', () => {
    expect(extractJson('  sorry  ')).toBe('sorry');
  });
});

describe('readResult', () => {
  it('returns the result text', () => {
    expect(readResult('{"is_error": false, "result": "hi"}')).toBe('hi');
  });

  it('reports a Claude error such as not being logged in', () => {
    expect(() =>
      readResult(
        '{"is_error": true, "result": "Not logged in · Please run /login"}',
      ),
    ).toThrow('Not logged in');
  });

  it('rejects output that is not JSON', () => {
    expect(() => readResult('oops')).toThrow('usual JSON output');
  });
});

describe('runClaude', () => {
  const cwd = os.tmpdir();

  it('sends the prompt on stdin and returns the result', async () => {
    const result = await runClaude(fake, 'こんにちは prompt', cwd);
    const parsed = JSON.parse(extractJson(result));
    expect(parsed.echo).toBe('こんにちは prompt');
    expect(parsed.args).toBe('-p --output-format json');
  });

  it('passes on the login error with a hint and without the raw output', async () => {
    process.env.FAKE_CLAUDE_MODE = 'not-logged-in';
    const error = await runClaude(fake, 'x', cwd).catch((e: Error) => e);
    expect((error as Error).message).toBe(
      'Claude reported an error: Not logged in · Please run /login. Open a terminal, run the Claude CLI once and sign in with /login, then try again.',
    );
  });

  it('includes stderr when the output is unreadable', async () => {
    process.env.FAKE_CLAUDE_MODE = 'garbage';
    await expect(runClaude(fake, 'x', cwd)).rejects.toThrow('something broke');
  });

  it('stops after the timeout', async () => {
    process.env.FAKE_CLAUDE_MODE = 'hang';
    await expect(runClaude(fake, 'x', cwd, 300)).rejects.toThrow('longer than');
  });
});

describe('findClaude', () => {
  let dir: string;

  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  function makeFile(...parts: string[]) {
    const file = path.join(dir, ...parts);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
    return file;
  }

  it('prefers KOTOBA_CLAUDE_PATH', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotoba-find-'));
    const custom = makeFile('custom', 'claude.exe');
    makeFile('bin', 'claude.exe');
    const found = findClaude({
      KOTOBA_CLAUDE_PATH: custom,
      PATH: path.join(dir, 'bin'),
    });
    expect(found?.command).toBe(custom);
  });

  it('finds the newest copy bundled with the desktop app', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotoba-find-'));
    const old = makeFile('Claude', 'claude-code', '2.1.0', 'aaa', 'claude.exe');
    const newer = makeFile(
      'Claude',
      'claude-code',
      '2.1.9',
      'bbb',
      'claude.exe',
    );
    fs.utimesSync(old, new Date(2026, 0, 1), new Date(2026, 0, 1));
    fs.utimesSync(newer, new Date(2026, 5, 1), new Date(2026, 5, 1));
    expect(findClaude({ PATH: '', APPDATA: dir })?.command).toBe(newer);
  });

  it('finds the standalone install when it is not on PATH', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotoba-find-'));
    const name = process.platform === 'win32' ? 'claude.exe' : 'claude';
    const standalone = makeFile('home', '.local', 'bin', name);
    makeFile('Claude', 'claude-code', '2.1.9', 'bbb', 'claude.exe');
    const found = findClaude({
      PATH: '',
      USERPROFILE: path.join(dir, 'home'),
      APPDATA: dir,
    });
    expect(found?.command).toBe(standalone);
  });

  it('returns null when nothing is installed', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotoba-find-'));
    expect(findClaude({ PATH: '', APPDATA: dir })).toBeNull();
  });
});
