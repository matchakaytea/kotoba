import { useEffect, useState } from 'react';
import type { Language, Mistake } from '../../shared/api';
import { describeMistake } from '../../shared/localize';
import type { Question } from '../../shared/test-schema';
import { formatTimestamp } from '../format';
import { useI18n } from '../i18n/i18n';

function answersAreJapanese(question: Question | null, language: Language) {
  if (!question || question.template === 'reading') return true;
  return (
    !question.i18n?.[language]?.options &&
    /[぀-ヿ]|[一-鿿]/.test(question.options.join(''))
  );
}

export function MistakesPage() {
  const { t, locale, language } = useI18n();
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null);

  useEffect(() => {
    window.kotoba.getMistakes().then(setMistakes);
  }, []);

  async function dismiss(id: number) {
    setMistakes(await window.kotoba.dismissMistake(id));
  }

  if (!mistakes) return null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('mistakes.title')}</h1>
          <p className="page-sub">{t('mistakes.sub')}</p>
        </div>
      </header>

      {mistakes.length === 0 ? (
        <p className="empty">{t('mistakes.empty')}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('mistakes.question')}</th>
              <th>{t('mistakes.yourAnswer')}</th>
              <th>{t('mistakes.correctAnswer')}</th>
              <th>{t('mistakes.when')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {mistakes.map((mistake) => {
              const shown = describeMistake(
                mistake.question,
                mistake.answer,
                language,
              );
              const answersLang = answersAreJapanese(mistake.question, language)
                ? 'ja'
                : undefined;
              return (
                <tr key={mistake.id}>
                  <td className="cell-prompt">
                    {shown.prompt ?? (
                      <span lang="ja">{mistake.targets.join('、')}</span>
                    )}
                  </td>
                  <td lang={answersLang} className="cell-wrong">
                    {shown.answer}
                  </td>
                  <td lang={answersLang} className="cell-right">
                    {shown.expected ?? '—'}
                  </td>
                  <td className="cell-muted">
                    {formatTimestamp(mistake.answeredAt, locale)}
                  </td>
                  <td className="actions-cell">
                    <button
                      className="subtle"
                      title={t('mistakes.deleteTitle')}
                      onClick={() => dismiss(mistake.id)}
                    >
                      {t('library.delete')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
