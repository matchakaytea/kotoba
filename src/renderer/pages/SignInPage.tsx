import { useEffect, useState, type FormEvent } from 'react';
import type { SyncStatus } from '../../shared/api';
import { useI18n } from '../i18n/i18n';

type Props = {
  onSignedIn: () => void;
  onGuest: () => void;
  /** Set when opened from inside the app, so there is a way back. */
  onBack?: () => void;
};

type Notice = { ok: boolean; text: string } | null;

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    '',
  );
}

/** Signing in keeps your progress and syncs it; without it nothing is kept. */
export function SignInPage({ onSignedIn, onGuest, onBack }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [editingProject, setEditingProject] = useState(false);
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

  const signIn = (event: FormEvent) => {
    event.preventDefault();
    return run(async () => {
      const next = await window.kotoba.signIn({ email, password });
      setPassword('');
      if (next.email) onSignedIn();
    });
  };

  const signUp = () =>
    run(async () => {
      const next = await window.kotoba.signUp({ email, password });
      setPassword('');
      if (next.email) onSignedIn();
      else if (next.confirm) {
        setNotice({ ok: true, text: t('sync.confirmEmail') });
      }
    });

  const saveProject = (event: FormEvent) => {
    event.preventDefault();
    return run(async () => {
      setStatus(await window.kotoba.configureSync({ url, key }));
      setEditingProject(false);
      setKey('');
    });
  };

  if (!status) return null;
  const showProject = editingProject || !status.url;

  return (
    <div className="signin">
      <div className="signin-card">
        {onBack && (
          <button type="button" className="subtle-neutral" onClick={onBack}>
            {t('signin.back')}
          </button>
        )}
        <div className="signin-mark" aria-hidden="true">
          言
        </div>
        <h1>{t('signin.title')}</h1>
        <p className="page-sub">{t('signin.sub')}</p>

        {showProject ? (
          <form className="form" onSubmit={saveProject}>
            <p className="field-label">{t('signin.project')}</p>
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
                <button type="button" onClick={() => setEditingProject(false)}>
                  {t('library.cancel')}
                </button>
              )}
            </div>
          </form>
        ) : (
          <form className="form" onSubmit={signIn}>
            <label className="field">
              <span className="field-label">{t('sync.email')}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
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
              <button type="submit" className="primary" disabled={busy}>
                {t('sync.signIn')}
              </button>
              <button type="button" disabled={busy} onClick={signUp}>
                {t('sync.signUp')}
              </button>
            </div>
          </form>
        )}

        {notice && (
          <p className={notice.ok ? 'form-status ok' : 'form-status error'}>
            {notice.text}
          </p>
        )}

        <div className="signin-guest">
          <button type="button" className="subtle-neutral" onClick={onGuest}>
            {t('signin.guest')}
          </button>
          <p className="field-hint">{t('signin.guestHint')}</p>
        </div>

        {!showProject && (
          <p className="signin-project">
            {t('sync.project', { url: status.url ?? '' })} ·{' '}
            <button
              type="button"
              className="link-button"
              onClick={() => setEditingProject(true)}
            >
              {t('sync.changeProject')}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
