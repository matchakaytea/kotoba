import { useEffect, useState } from 'react';
import type { Mistake } from '../../shared/api';
import { formatTimestamp } from '../format';
import { useI18n } from '../i18n/i18n';

export function MistakesPage() {
  const { t, locale } = useI18n();
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null);

  useEffect(() => {
    window.kotoba.getMistakes().then(setMistakes);
  }, []);

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
            </tr>
          </thead>
          <tbody>
            {mistakes.map((mistake, i) => (
              <tr key={i}>
                <td className="cell-prompt">
                  {mistake.prompt ?? (
                    <span lang="ja">{mistake.targets.join('、')}</span>
                  )}
                </td>
                <td lang="ja" className="cell-wrong">
                  {mistake.answer}
                </td>
                <td lang="ja" className="cell-right">
                  {mistake.expected ?? '—'}
                </td>
                <td className="cell-muted">
                  {formatTimestamp(mistake.answeredAt, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
