import { useEffect, useState, type FormEvent } from 'react';
import type { SyncStatus } from '../shared/api';
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

/** Connects Kotoba to the learner's Supabase project for syncing devices. */
export function SyncPanel() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const saveProject = (event: FormEvent) => {
    event.preventDefault();
    return run(async () => {
      setStatus(await window.kotoba.configureSync({ url, key }));
      setEditing(false);
      setKey('');
    });
  };

  const signIn = () =>
    run(async () => {
      setStatus(await window.kotoba.signIn({ email, password }));
      setPassword('');
    });

  const signUp = () =>
    run(async () => {
      const result = await window.kotoba.signUp({ email, password });
      setStatus(result);
      setPassword('');
      if (result.confirm) setNotice({ ok: true, text: t('sync.confirmEmail') });
    });

  if (!status) return null;
  const showProjectForm = editing || !status.url;

  return (
    <section className="data-panel">
      <h2>{t('sync.title')}</h2>
      <p className="page-sub">{t('sync.sub')}</p>

      {showProjectForm ? (
        <form className="form sync-form" onSubmit={saveProject}>
          <label className="field">
            <span className="field-label">{t('sync.url')}</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://abcdefgh.supabase.co"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span className="field-label">{t('sync.key')}</span>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJ… / sb_publishable_…"
              autoComplete="off"
            />
            <span className="field-hint">{t('sync.keyHint')}</span>
          </label>
          <div className="form-actions">
            <button type="submit" className="primary" disabled={busy}>
              {t('sync.saveProject')}
            </button>
            {status.url && (
              <button type="button" onClick={() => setEditing(false)}>
                {t('library.cancel')}
              </button>
            )}
          </div>
        </form>
      ) : status.email ? (
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
                run(async () => setStatus(await window.kotoba.signOut()))
              }
            >
              {t('sync.signOut')}
            </button>
          </div>
        </>
      ) : (
        <div className="form sync-form">
          <p className="cell-muted">
            {t('sync.project', { url: status.url ?? '' })}
          </p>
          <label className="field">
            <span className="field-label">{t('sync.email')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span className="field-label">{t('sync.password')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <span className="field-hint">{t('sync.passwordHint')}</span>
          </label>
          <div className="form-actions">
            <button className="primary" disabled={busy} onClick={signIn}>
              {t('sync.signIn')}
            </button>
            <button disabled={busy} onClick={signUp}>
              {t('sync.signUp')}
            </button>
            <button
              className="subtle-neutral"
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              {t('sync.changeProject')}
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p className={notice.ok ? 'form-status ok' : 'form-status error'}>
          {notice.text}
        </p>
      )}
    </section>
  );
}
