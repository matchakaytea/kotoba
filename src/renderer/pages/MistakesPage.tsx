import { useEffect, useState } from 'react';
import type { Mistake } from '../../shared/api';
import { formatTimestamp } from '../format';

export function MistakesPage() {
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null);

  useEffect(() => {
    window.kotoba.getMistakes().then(setMistakes);
  }, []);

  if (!mistakes) return null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Mistakes</h1>
          <p className="page-sub">
            Your recent wrong answers. Each word comes back in a later review,
            and Claude's next test focuses on them.
          </p>
        </div>
      </header>

      {mistakes.length === 0 ? (
        <p className="empty">No mistakes yet. Wrong answers show up here.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Question</th>
              <th>Your answer</th>
              <th>Correct answer</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {mistakes.map((mistake, i) => (
              <tr key={i}>
                <td lang="ja" className="cell-prompt">
                  {mistake.prompt ?? mistake.targets.join('、')}
                </td>
                <td lang="ja" className="cell-wrong">
                  {mistake.answer}
                </td>
                <td lang="ja" className="cell-right">
                  {mistake.expected ?? '—'}
                </td>
                <td className="cell-muted">
                  {formatTimestamp(mistake.answeredAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
