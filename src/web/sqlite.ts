import type { Database, SqlValue } from 'sql.js';

// Gives sql.js (SQLite compiled to WebAssembly) the small part of Node's
// DatabaseSync API that Kotoba's database code uses, so the same code runs in
// the browser.

type Params = SqlValue[];

function bindable(params: unknown[]): Params {
  return params.map((value) =>
    value === undefined ? null : (value as SqlValue),
  );
}

class Statement {
  constructor(
    private readonly db: Database,
    private readonly sql: string,
    private readonly onWrite: () => void,
  ) {}

  run(...params: unknown[]): {
    changes: number;
    lastInsertRowid: number;
  } {
    this.db.run(this.sql, bindable(params));
    const changes = this.db.getRowsModified();
    const id = this.db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0];
    this.onWrite();
    return { changes, lastInsertRowid: Number(id ?? 0) };
  }

  get(...params: unknown[]): Record<string, unknown> | undefined {
    return this.all(...params)[0];
  }

  all(...params: unknown[]): Record<string, unknown>[] {
    const statement = this.db.prepare(this.sql);
    try {
      statement.bind(bindable(params));
      const rows: Record<string, unknown>[] = [];
      while (statement.step()) rows.push(statement.getAsObject());
      if (/^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(this.sql)) this.onWrite();
      return rows;
    } finally {
      statement.free();
    }
  }
}

export class WebDatabase {
  constructor(
    private readonly db: Database,
    private readonly onWrite: () => void,
  ) {}

  prepare(sql: string): Statement {
    return new Statement(this.db, sql, this.onWrite);
  }

  exec(sql: string): void {
    this.db.exec(sql);
    if (!/^\s*(SELECT|PRAGMA\s+\w+\s*$|BEGIN)/i.test(sql)) this.onWrite();
  }

  close(): void {
    this.db.close();
  }

  export(): Uint8Array {
    return this.db.export();
  }
}
