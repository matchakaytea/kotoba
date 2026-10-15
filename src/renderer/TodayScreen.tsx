import { useEffect, useState } from 'react';
import type { DueTarget, Today } from '../shared/api';
import type { LangTest } from '../shared/test-schema';

type Props = {
  test: LangTest;
  onStart: () => void;
};

export function TodayScreen({ test, onStart }: Props) {
  const [today, setToday] = useState<Today | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.kotoba
      .getToday()
      .then(setToday)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) return <main className="save-error">{error}</main>;
  if (!today) return <main />;

  const { due, nextDueDay, summary } = today;

  return (
    <main>
      <header className="today-header">
        <h1>今日</h1>
        <span>
          {formatDay(today.today, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </header>

      {due.length > 0 ? (
        <>
          <p className="due-count">{due.length} due today</p>
          <ul className="due-list">
            {due.map((target) => (
              <DueItem
                key={`${target.expression}-${target.skill}`}
                target={target}
                today={today.today}
              />
            ))}
          </ul>
        </>
      ) : (
        <p className="due-count">
          Nothing due today.
          {nextDueDay && (
            <span className="next-due">
              {' '}
              Next review: {formatDay(nextDueDay)}
            </span>
          )}
        </p>
      )}

      <button className="start" autoFocus onClick={onStart}>
        Start: {test.title}
      </button>

      <p className="all-time">
        All time: {summary.correct} / {summary.attempts} answers correct ·{' '}
        {summary.targets} targets
      </p>
    </main>
  );
}

function DueItem({ target, today }: { target: DueTarget; today: string }) {
  let status = 'new';
  if (target.dueDay && target.dueDay < today)
    status = `overdue since ${formatDay(target.dueDay)}`;
  else if (target.dueDay) status = 'due';

  return (
    <li className="due-item">
      <span className="due-expression">{target.expression}</span>
      {target.reading && <span className="due-reading">{target.reading}</span>}
      <span className="due-skill">{target.skill}</span>
      <span className="due-status">{status}</span>
    </li>
  );
}

function formatDay(
  day: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(undefined, options);
}
