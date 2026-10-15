import { useEffect, useState } from 'react';
import type { LibraryTest } from '../../shared/api';
import { formatTimestamp } from '../format';

export function LibraryPage() {
  const [tests, setTests] = useState<LibraryTest[] | null>(null);

  useEffect(() => {
    window.kotoba.getLibrary().then(setTests);
  }, []);

  if (!tests) return null;

  const total = tests.reduce((sum, test) => sum + test.questions, 0);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Library</h1>
          <p className="page-sub">
            {tests.length} {tests.length === 1 ? 'test' : 'tests'} · {total}{' '}
            questions. Reviews draw from all of them.
          </p>
        </div>
      </header>

      {tests.length === 0 ? (
        <p className="empty">
          No tests yet. Generate one on Today, or add a file in Inbox.
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th className="num">Questions</th>
              <th>Imported</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((test) => (
              <tr key={test.id}>
                <td>
                  {test.title}
                  <span className="cell-id">{test.id}</span>
                </td>
                <td className="num">{test.questions}</td>
                <td className="cell-muted">
                  {formatTimestamp(test.importedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
