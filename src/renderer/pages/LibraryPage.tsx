import { useEffect, useState } from 'react';
import type { LibraryTest } from '../../shared/api';
import { cleanError, formatTimestamp } from '../format';

export function LibraryPage() {
  const [tests, setTests] = useState<LibraryTest[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.kotoba.getLibrary().then(setTests);
  }, []);

  async function remove(testId: string) {
    setError(null);
    try {
      setTests(await window.kotoba.deleteTest(testId));
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setConfirming(null);
    }
  }

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

      {error && <p className="notice error">{error}</p>}

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
              <th className="actions-cell" aria-label="Actions" />
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
                <td className="actions-cell">
                  {confirming === test.id ? (
                    <span className="confirm">
                      <span className="confirm-text">
                        Delete {test.questions} questions?
                      </span>
                      <button
                        className="danger"
                        autoFocus
                        onClick={() => remove(test.id)}
                      >
                        Delete
                      </button>
                      <button onClick={() => setConfirming(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      className="subtle"
                      onClick={() => setConfirming(test.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tests.length > 0 && (
        <p className="page-footer">
          Deleting a test removes its questions. Words you've already practised
          keep their progress, and come back in a future generated test.
        </p>
      )}
    </div>
  );
}
