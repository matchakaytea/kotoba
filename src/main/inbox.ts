import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { ImportReport } from '../shared/api';
import type { LangTest } from '../shared/test-schema';
import { validateTestFile } from '../shared/validate-test-file';
import { saveTest } from './database';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type InboxDirs = {
  inbox: string;
  imported: string;
  rejected: string;
};

export function inboxDirs(root: string): InboxDirs {
  return {
    inbox: path.join(root, 'inbox'),
    imported: path.join(root, 'imported'),
    rejected: path.join(root, 'rejected'),
  };
}

export function ensureInboxDirs(dirs: InboxDirs): void {
  for (const dir of Object.values(dirs)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function importInbox(
  db: DatabaseSync,
  dirs: InboxDirs,
  now = new Date(),
): ImportReport {
  ensureInboxDirs(dirs);
  const report: ImportReport = { imported: [], rejected: [] };
  const stamp = now.toISOString().replace(/[:.]/g, '-');

  const files = fs
    .readdirSync(dirs.inbox)
    .filter((file) => file.toLowerCase().endsWith('.json'))
    .sort();

  for (const file of files) {
    const source = path.join(dirs.inbox, file);
    const result = importFile(db, source, now);

    if ('test' in result) {
      fs.renameSync(source, path.join(dirs.imported, `${stamp}_${file}`));
      report.imported.push({
        file,
        title: result.test.title,
        questions: result.test.questions.length,
      });
    } else {
      const destination = path.join(dirs.rejected, `${stamp}_${file}`);
      fs.renameSync(source, destination);
      fs.writeFileSync(
        `${destination}.errors.txt`,
        result.errors.join('\n') + '\n',
        'utf8',
      );
      report.rejected.push({ file, errors: result.errors });
    }
  }
  return report;
}

function importFile(
  db: DatabaseSync,
  file: string,
  now: Date,
): { test: LangTest } | { errors: string[] } {
  if (fs.statSync(file).size > MAX_FILE_BYTES) {
    return { errors: ['File is larger than 2 MB'] };
  }
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const result = validateTestFile(text);
  if (!result.ok) {
    return { errors: result.errors };
  }
  try {
    saveTest(db, result.test, now);
    return { test: result.test };
  } catch (error) {
    return { errors: [`Could not save: ${(error as Error).message}`] };
  }
}
