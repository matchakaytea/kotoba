import { useEffect, useState } from 'react';
import type { DueTarget, ImportReport, Today } from '../../shared/api';
import { formatDay } from '../format';
import { useI18n } from '../i18n/i18n';
import type { MessageKey } from '../i18n/messages';
import { ImportNotice } from '../ImportNotice';

export type Generation = {
  available: boolean;
  running: boolean;
  /** Making today's test on its own, not from the button. */
  auto: boolean;
  error: string | null;
  lastReport: ImportReport | null;
  run: () => void;
};

type Props = {
  generation: Generation;
  onStart: () => void;
};

const SKILLS = ['reading', 'meaning', 'usage', 'grammar', 'production'];

export function TodayPage({ generation, onStart }: Props) {
  const { t, locale } = useI18n();
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

  let subtitle = t('today.getStarted');
  if (due.length > 0) {
    subtitle = t('today.questionsReady', { count: questionsReady });
    if (missing > 0) {
      subtitle += ` · ${t('today.needQuestions', { count: missing })}`;
    }
  } else if (nextDueDay) {
    subtitle = t('today.nextReview', {
      date: formatDay(nextDueDay, locale, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    });
  }

  const footer = [
    t('today.answers', { count: summary.attempts }),
    accuracy !== null ? t('today.accuracy', { percent: accuracy }) : null,
    t('today.targets', { count: summary.targets }),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="page-kicker">
            {formatDay(today.today, locale, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <h1>
            {due.length > 0
              ? t('today.dueCount', { count: due.length })
              : t('today.nothingDue')}
          </h1>
          <p className="page-sub">{subtitle}</p>
        </div>
        <div className="header-actions">
          {generation.available && (
            <button disabled={generation.running} onClick={generation.run}>
              {generation.running ? t('today.generating') : t('today.generate')}
            </button>
          )}
          <button
            className="primary"
            autoFocus
            disabled={questionsReady === 0}
            onClick={onStart}
          >
            {t('today.start')}
          </button>
        </div>
      </header>

      {generation.running && (
        <p className="notice notice-info">
          {generation.auto && <strong>{t('today.autoGenerating')} </strong>}
          {t('today.generatingNotice')}
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

      <footer className="page-footer">{footer}</footer>
    </div>
  );
}

function DueRow({ target, today }: { target: DueTarget; today: string }) {
  const { t, locale } = useI18n();
  let status = t('status.new');
  let tone = 'muted';
  if (target.dueDay && target.dueDay < today) {
    status = t('status.overdue', { date: formatDay(target.dueDay, locale) });
    tone = 'warning';
  } else if (target.dueDay) {
    status = t('status.due');
  }

  const skill = SKILLS.includes(target.skill)
    ? t(`skill.${target.skill}` as MessageKey)
    : target.skill;

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
      <span className="tag">{skill}</span>
      {!target.hasQuestion && (
        <span className="tag tag-warning">{t('status.noQuestion')}</span>
      )}
      <span className={`row-status ${tone}`}>{status}</span>
    </li>
  );
}
