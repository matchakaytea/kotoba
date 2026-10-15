import { useEffect, useState } from 'react';
import type { LibraryTest } from '../../shared/api';
import { cleanError, formatTimestamp } from '../format';
import { useI18n } from '../i18n/i18n';

export function LibraryPage() {
  const { t, locale } = useI18n();
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
          <h1>{t('library.title')}</h1>
          <p className="page-sub">
            {t('library.sub', { count: tests.length, questions: total })}
          </p>
        </div>
      </header>

      {error && <p className="notice error">{error}</p>}

      {tests.length === 0 ? (
        <p className="empty">{t('library.empty')}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('library.testTitle')}</th>
              <th className="num">{t('library.questions')}</th>
              <th>{t('library.imported')}</th>
              <th className="actions-cell" />
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
                  {formatTimestamp(test.importedAt, locale)}
                </td>
                <td className="actions-cell">
                  {confirming === test.id ? (
                    <span className="confirm">
                      <span className="confirm-text">
                        {t('library.confirm', { count: test.questions })}
                      </span>
                      <button
                        className="danger"
                        autoFocus
                        onClick={() => remove(test.id)}
                      >
                        {t('library.delete')}
                      </button>
                      <button onClick={() => setConfirming(null)}>
                        {t('library.cancel')}
                      </button>
                    </span>
                  ) : (
                    <button
                      className="subtle"
                      onClick={() => setConfirming(test.id)}
                    >
                      {t('library.delete')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tests.length > 0 && <p className="page-footer">{t('library.footer')}</p>}
    </div>
  );
}
