import { useEffect, useState } from 'react';
import type { DueTarget, ImportReport, Today } from '../../shared/api';
import { formatDay } from '../format';
import { ImportNotice } from '../ImportNotice';

export type Generation = {
  available: boolean;
  running: boolean;
  error: string | null;
  lastReport: ImportReport | null;
  run: () => void;
};

type Props = {
  generation: Generation;
  onStart: () => void;
};

export function TodayPage({ generation, onStart }: Props) {
  const [today, setToday] = useState<Today | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const imported = await window.kotoba.importInbox();
        const latest = await window.kotoba.getToday();
        if (!active) return;
        setReport(imported);
        setToday(latest);
      } catch (e) {
        if (active) setError(String(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [generation.lastReport]);

  async function dismissReport() {
    await window.kotoba.dismissImportReport();
    setReport(null);
  }

  if (error) return <p className="error">{error}</p>;
  if (!today) return null;

  const { due, nextDueDay, questionsReady, summary } = today;
  const missing = due.filter((target) => !target.hasQuestion).length;
  const accuracy =
    summary.attempts > 0
      ? Math.round((summary.correct / summary.attempts) * 100)
      : null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="page-kicker">
            {formatDay(today.today, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <h1>
            {due.length > 0 ? `${due.length} due today` : 'Nothing due today'}
          </h1>
          <p className="page-sub">
            {due.length > 0
              ? `${questionsReady} questions ready${missing > 0 ? ` · ${missing} need new questions` : ''}`
              : nextDueDay
                ? `Next review: ${formatDay(nextDueDay, { weekday: 'long', month: 'short', day: 'numeric' })}`
                : 'Generate a test to get started.'}
          </p>
        </div>
        <div className="header-actions">
          {generation.available && (
            <button disabled={generation.running} onClick={generation.run}>
              {generation.running ? 'Generating…' : 'Generate test'}
            </button>
          )}
          <button
            className="primary"
            autoFocus
            disabled={questionsReady === 0}
            onClick={onStart}
          >
            Start review
          </button>
        </div>
      </header>

      {generation.running && (
        <p className="notice notice-info">
          Claude is writing a test from your due words and mistakes. This
          usually takes a minute or two. You can keep using the app.
        </p>
      )}
      {generation.error && <p className="notice error">{generation.error}</p>}
      {report && <ImportNotice report={report} onDismiss={dismissReport} />}

      {due.length > 0 && (
        <ul className="row-list">
          {due.map((target) => (
            <DueRow
              key={`${target.expression}-${target.skill}`}
              target={target}
              today={today.today}
            />
          ))}
        </ul>
      )}

      <footer className="page-footer">
        {summary.attempts} answers
        {accuracy !== null && ` · ${accuracy}% correct`} · {summary.targets}{' '}
        words and skills
      </footer>
    </div>
  );
}

function DueRow({ target, today }: { target: DueTarget; today: string }) {
  let status = 'new';
  let tone = 'muted';
  if (target.dueDay && target.dueDay < today) {
    status = `overdue since ${formatDay(target.dueDay)}`;
    tone = 'warning';
  } else if (target.dueDay) {
    status = 'due';
  }

  return (
    <li className="row">
      <span className="row-expression" lang="ja">
        {target.expression}
      </span>
      {target.reading && (
        <span className="row-reading" lang="ja">
          {target.reading}
        </span>
      )}
      <span className="tag">{target.skill}</span>
      {!target.hasQuestion && (
        <span className="tag tag-warning">no question</span>
      )}
      <span className={`row-status ${tone}`}>{status}</span>
    </li>
  );
}
