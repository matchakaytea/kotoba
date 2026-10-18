import { useState } from 'react';
import type { BackupChoice } from '../shared/api';
import { useI18n } from './i18n/i18n';

type Status = { ok: boolean; text: string } | null;

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    '',
  );
}

/** Back up, restore and find the learner's data. */
export function DataPanel() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>(null);
  const [choice, setChoice] = useState<BackupChoice | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setStatus(null);
    try {
      await action();
    } catch (error) {
      setStatus({ ok: false, text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  const backup = () =>
    run(async () => {
      const file = await window.kotoba.backupData();
      if (file) setStatus({ ok: true, text: t('data.saved', { file }) });
    });

  const pick = () =>
    run(async () => {
      setChoice(await window.kotoba.pickBackup());
    });

  const restore = () =>
    run(async () => {
      await window.kotoba.restoreData();
      window.location.reload();
    });

  return (
    <section className="data-panel">
      <h2>{t('data.title')}</h2>
      <p className="page-sub">{t('data.sub')}</p>
      {choice ? (
        <div className="confirm">
          <span className="confirm-text">
            {t('data.confirm', {
              name: choice.name,
              tests: choice.tests,
              answers: choice.answers,
              words: choice.words,
            })}
          </span>
          <button className="danger" disabled={busy} onClick={restore}>
            {t('data.restore')}
          </button>
          <button disabled={busy} onClick={() => setChoice(null)}>
            {t('library.cancel')}
          </button>
        </div>
      ) : (
        <div className="form-actions">
          <button disabled={busy} onClick={backup}>
            {t('data.backup')}
          </button>
          <button disabled={busy} onClick={pick}>
            {t('data.restoreFrom')}
          </button>
          <button
            className="subtle-neutral"
            disabled={busy}
            onClick={() => run(() => window.kotoba.openDataFolder())}
          >
            {t('data.openFolder')}
          </button>
        </div>
      )}
      {status && (
        <p className={status.ok ? 'form-status ok' : 'form-status error'}>
          {status.text}
        </p>
      )}
    </section>
  );
}
