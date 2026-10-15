import { useEffect, useState } from 'react';
import type { DueTarget, ImportReport, Today } from '../shared/api';

type Props = {
  onStart: () => void;
};

export function TodayScreen({ onStart }: Props) {
  const [today, setToday] = useState<Today | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [claudeFound, setClaudeFound] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setReport(await window.kotoba.importInbox());
      setToday(await window.kotoba.getToday());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refresh();
    window.kotoba.claudeStatus().then((status) => setClaudeFound(status.found));
  }, []);

  async function generate() {
    setGenerating(true);
    setGenerateError(null);
    setMessage(null);
    try {
      setReport(await window.kotoba.generateTest());
      setToday(await window.kotoba.getToday());
    } catch (e) {
      setGenerateError(cleanError(e));
    } finally {
      setGenerating(false);
    }
  }

  async function dismissReport() {
    await window.kotoba.dismissImportReport();
    setReport(null);
  }

  async function copyBrief() {
    try {
      await window.kotoba.copyBrief();
      setMessage(
        'Brief copied. Paste it into Claude, save the reply as a .json file in the inbox, then press Check inbox.',
      );
    } catch (e) {
      setError(String(e));
    }
  }

  if (error) return <main className="save-error">{error}</main>;
  if (!today) return <main />;

  const { due, nextDueDay, questionsReady, summary } = today;
  const missing = due.filter((target) => !target.hasQuestion).length;

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

      {report && <ImportNotice report={report} onDismiss={dismissReport} />}

      {due.length > 0 ? (
        <>
          <p className="due-count">
            {due.length} due today
            <span className="next-due">
              {questionsReady} questions ready
              {missing > 0 && ` · ${missing} need new questions`}
            </span>
          </p>
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
              Next review: {formatDay(nextDueDay)}
            </span>
          )}
        </p>
      )}

      <div className="actions">
        <button
          className="start"
          autoFocus
          disabled={questionsReady === 0}
          onClick={onStart}
        >
          Start review
        </button>
        {claudeFound && (
          <button disabled={generating} onClick={generate}>
            {generating ? 'Generating…' : 'Generate test with Claude'}
          </button>
        )}
        <button onClick={copyBrief}>Copy brief for Claude</button>
        <button onClick={() => window.kotoba.openInbox()}>Open inbox</button>
        <button onClick={refresh}>Check inbox</button>
      </div>
      {generating && (
        <p className="hint">
          Claude is writing a test from your due words and mistakes. This
          usually takes a minute or two.
        </p>
      )}
      {generateError && <p className="save-error">{generateError}</p>}
      {message && <p className="hint">{message}</p>}

      <p className="all-time">
        All time: {summary.correct} / {summary.attempts} answers correct ·{' '}
        {summary.targets} targets
      </p>
    </main>
  );
}

function ImportNotice({
  report,
  onDismiss,
}: {
  report: ImportReport;
  onDismiss: () => void;
}) {
  if (report.imported.length === 0 && report.rejected.length === 0) {
    return null;
  }
  return (
    <div className="import-notice">
      <button className="dismiss" aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
      {report.imported.map((item, i) => (
        <p key={`ok-${i}`}>
          ✓ Imported “{item.title}” ({item.questions} questions)
        </p>
      ))}
      {report.rejected.map((item, i) => (
        <details key={`bad-${i}`} className="rejected">
          <summary>
            ✗ {item.file} was rejected ({item.errors.length} problems)
          </summary>
          <ul>
            {item.errors.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function DueItem({ target, today }: { target: DueTarget; today: string }) {
  let status = 'new';
  if (target.dueDay && target.dueDay < today)
    status = `overdue since ${formatDay(target.dueDay)}`;
  else if (target.dueDay) status = 'due';
  if (!target.hasQuestion) status += ' · no question';

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

function cleanError(error: unknown): string {
  return String(error).replace(
    /^Error: Error invoking remote method '[^']+': (Error: )?/,
    '',
  );
}
