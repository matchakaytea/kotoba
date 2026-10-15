import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSession, openDatabase } from './database';
import { importInbox, inboxDirs, type InboxDirs } from './inbox';

const sample = fs.readFileSync('samples/it-n2.json', 'utf8');
const now = new Date(2026, 9, 15, 9, 0);

let root: string;
let dirs: InboxDirs;
let db: DatabaseSync;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'kotoba-inbox-'));
  dirs = inboxDirs(root);
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

function drop(name: string, content: string) {
  fs.mkdirSync(dirs.inbox, { recursive: true });
  fs.writeFileSync(path.join(dirs.inbox, name), content, 'utf8');
}

describe('importInbox', () => {
  it('creates the folders when they are missing', () => {
    importInbox(db, dirs, now);
    expect(fs.existsSync(dirs.inbox)).toBe(true);
    expect(fs.existsSync(dirs.imported)).toBe(true);
    expect(fs.existsSync(dirs.rejected)).toBe(true);
  });

  it('imports a valid test and moves it out of the inbox', () => {
    drop('sample.json', sample);
    const report = importInbox(db, dirs, now);

    expect(report.imported).toEqual([
      { file: 'sample.json', title: 'IT vocabulary – sample', questions: 5 },
    ]);
    expect(fs.readdirSync(dirs.inbox)).toEqual([]);
    expect(fs.readdirSync(dirs.imported)).toHaveLength(1);
    expect(buildSession(db, now).items).toHaveLength(5);
  });

  it('accepts a file that starts with a byte order mark', () => {
    drop('bom.json', '﻿' + sample);
    expect(importInbox(db, dirs, now).imported).toHaveLength(1);
  });

  it('rejects an invalid test and writes the errors next to it', () => {
    const broken = JSON.parse(sample);
    broken.questions[1].answers = ['fukkyuu'];
    drop('broken.json', JSON.stringify(broken));

    const report = importInbox(db, dirs, now);

    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0].errors).toContain(
      'Question 2 → answers[0]: answers must be kana only',
    );
    const rejectedFiles = fs.readdirSync(dirs.rejected);
    expect(rejectedFiles).toHaveLength(2);
    const errorsFile = rejectedFiles.find((f) => f.endsWith('.errors.txt'))!;
    expect(
      fs.readFileSync(path.join(dirs.rejected, errorsFile), 'utf8'),
    ).toContain('kana only');
    expect(buildSession(db, now).items).toHaveLength(0);
  });

  it('ignores files that are not JSON', () => {
    drop('notes.txt', 'hello');
    const report = importInbox(db, dirs, now);
    expect(report).toEqual({ imported: [], rejected: [] });
    expect(fs.readdirSync(dirs.inbox)).toEqual(['notes.txt']);
  });

  it('handles a good and a bad file in the same run', () => {
    drop('a-good.json', sample);
    drop('b-bad.json', '{ not json');
    const report = importInbox(db, dirs, now);
    expect(report.imported).toHaveLength(1);
    expect(report.rejected).toHaveLength(1);
  });
});
