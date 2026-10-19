import { useEffect, useState } from 'react';
import type { SyncStatus } from '../shared/api';
import { useAccount } from './account';
import { formatTimestamp } from './format';
import { useI18n } from './i18n/i18n';

type Notice = { ok: boolean; text: string } | null;

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    '',
  );
}

/** Who is signed in and how syncing is going; signing in has its own page. */
export function SyncPanel() {
  const { t, locale } = useI18n();
  const account = useAccount();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    window.kotoba.syncStatus().then(setStatus);
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice({ ok: false, text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  return (
    <section className="data-panel">
      <h2>{t('sync.title')}</h2>
      <p className="page-sub">{t('sync.sub')}</p>

      {status.email ? (
        <>
          <p>
            {t('sync.signedIn', { email: status.email })}
            {status.lastSync &&
              ` · ${t('sync.last', { when: formatTimestamp(status.lastSync, locale) })}`}
          </p>
          {status.error && (
            <p className="form-status error">
              {t('sync.failed', { error: status.error })}
            </p>
          )}
          <div className="form-actions">
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setStatus(await window.kotoba.syncNow());
                  setNotice({ ok: true, text: t('sync.done') });
                })
              }
            >
              {busy ? t('sync.syncing') : t('sync.now')}
            </button>
            <button
              className="subtle-neutral"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setStatus(await window.kotoba.signOut());
                  await account.refresh();
                })
              }
            >
              {t('sync.signOut')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>{t('account.signedOut')}</p>
          <div className="form-actions">
            <button className="primary" onClick={account.openSignIn}>
              {t('sync.signIn')}
            </button>
          </div>
        </>
      )}

      {notice && (
        <p className={notice.ok ? 'form-status ok' : 'form-status error'}>
          {notice.text}
        </p>
      )}
    </section>
  );
}
