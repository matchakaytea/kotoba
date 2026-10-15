import { useEffect, useState } from 'react';
import { LANGUAGES, type LibraryTest } from '../../shared/api';
import { localizeTitle } from '../../shared/localize';
import { cleanError, formatTimestamp } from '../format';
import { useI18n } from '../i18n/i18n';

export function LibraryPage() {
  const { t, locale, language } = useI18n();
  const [tests, setTests] = useState<LibraryTest[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);
  const [claudeAvailable, setClaudeAvailable] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const titleOf = (test: LibraryTest) =>
    localizeTitle(test.title, test.titleI18n, language);
  const languageNames = (test: LibraryTest) =>
    test.missingLanguages
      .map((code) => LANGUAGES.find((option) => option.code === code)?.name)
      .join(', ');

  useEffect(() => {
    window.kotoba.getLibrary().then(setTests);
    window.kotoba
      .claudeStatus()
      .then((status) => setClaudeAvailable(status.found));
  }, []);

  async function remove(testId: string) {
    setNotice(null);
    try {
      setTests(await window.kotoba.deleteTest(testId));
    } catch (e) {
      setNotice({ ok: false, text: cleanError(e) });
    } finally {
      setConfirming(null);
    }
  }

  async function translate(test: LibraryTest) {
    setNotice(null);
    setTranslating(test.id);
    try {
      const updated = await window.kotoba.translateTest(test.id);
      setTests(updated);
      const item = updated.find((entry) => entry.id === test.id);
      const title = item ? titleOf(item) : '';
      setNotice({ ok: true, text: t('library.translated', { title }) });
    } catch (e) {
      setNotice({ ok: false, text: cleanError(e) });
    } finally {
      setTranslating(null);
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

      {translating && (
        <p className="notice notice-info">{t('library.translatingNotice')}</p>
      )}
      {notice && (
        <p className={notice.ok ? 'notice notice-ok' : 'notice error'}>
          {notice.text}
        </p>
      )}

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
                  {titleOf(test)}
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
                    <span className="row-actions">
                      {claudeAvailable && test.missingLanguages.length > 0 && (
                        <button
                          className="subtle-neutral"
                          title={t('library.translateTitle', {
                            languages: languageNames(test),
                          })}
                          disabled={translating !== null}
                          onClick={() => translate(test)}
                        >
                          {translating === test.id
                            ? t('library.translating')
                            : t('library.translate')}
                        </button>
                      )}
                      <button
                        className="subtle"
                        disabled={translating === test.id}
                        onClick={() => setConfirming(test.id)}
                      >
                        {t('library.delete')}
                      </button>
                    </span>
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
