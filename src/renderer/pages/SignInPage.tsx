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

// The words drifting behind the brand: hello, thanks and the names of the
// languages Kotoba speaks.
const WORDS = [
  'こんにちは',
  '안녕하세요',
  '你好',
  '言葉',
  'Hello',
  'ありがとう',
  '감사합니다',
  '学习',
  '學習',
  'Explore',
  '日本語',
  '한국어',
  '简体中文',
  '繁體中文',
  'English',
  '世界',
  '반가워요',
  '友達',
  '朋友',
  'Discover',
];

// Each row repeats its words twice so the scroll can loop without a jump.
const ROWS = Array.from({ length: 11 }, (_, row) => {
  const words = Array.from(
    { length: 20 },
    (_, i) => WORDS[(i * 3 + row * 5) % WORDS.length],
  );
  return {
    speed: row % 3 === 1 ? 'reverse' : row % 3 === 2 ? 'slow' : '',
    delay: `-${(row * 5.7) % 34}s`,
    words: [...words, ...words],
  };
});

/** Signing in keeps your progress and syncs it; without it nothing is kept. */
export function SignInPage({ onSignedIn, onGuest, onBack }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="signin">
      <section className="si-art" aria-hidden="true">
        <div className="si-glow" />
        <div className="si-pattern">
          {ROWS.map((row, i) => (
            <div
              key={i}
              className={`si-track ${row.speed}`}
              style={{ animationDelay: row.delay }}
            >
              {row.words.map((word, j) => (
                <div key={j} className="si-tile">
                  {word}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="si-brand">
          <span className="si-logo">言</span> Kotoba
        </div>
        <div className="si-copy">
          <div className="si-eyebrow">{t('signin.eyebrow')}</div>
          <h2>{t('signin.headline')}</h2>
          <p>{t('signin.tagline')}</p>
        </div>
      </section>

      <section className="si-pane">
        <div className="si-content">
          {onBack && (
            <button type="button" className="si-back" onClick={onBack}>
              {t('signin.back')}
            </button>
          )}
          <div className="si-welcome">{t('signin.welcome')}</div>
          <h1>{t('signin.greeting')}</h1>
          <p className="si-sub">{t('signin.pickUp')}</p>

          {showProject ? (
            <form onSubmit={saveProject}>
              <p className="si-label">{t('signin.project')}</p>
              <div className="si-field">
                <label htmlFor="si-url">{t('sync.url')}</label>
                <input
                  id="si-url"
                  className="si-input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://abcdefgh.supabase.co"
                  autoComplete="off"
                />
              </div>
              <div className="si-field">
                <label htmlFor="si-key">{t('sync.key')}</label>
                <input
                  id="si-key"
                  className="si-input"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="eyJ… / sb_publishable_…"
                  autoComplete="off"
                />
                <p className="si-hint">{t('sync.keyHint')}</p>
              </div>
              <div className="si-actions">
                <button type="submit" className="si-submit" disabled={busy}>
                  {t('sync.saveProject')}
                </button>
                <button type="button" className="si-guest" onClick={onGuest}>
                  {t('signin.guest')}
                </button>
              </div>
              {status.url && (
                <p className="si-signup">
                  <button
                    type="button"
                    className="si-link"
                    onClick={() => setEditingProject(false)}
                  >
                    {t('library.cancel')}
                  </button>
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={signIn}>
              <div className="si-field">
                <label htmlFor="si-email">{t('sync.email')}</label>
                <input
                  id="si-email"
                  className="si-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('signin.emailPlaceholder')}
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="si-field">
                <label htmlFor="si-password">{t('sync.password')}</label>
                <div className="si-input-wrap">
                  <input
                    id="si-password"
                    className="si-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('signin.passwordPlaceholder')}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="si-eye"
                    aria-label={
                      showPassword
                        ? t('signin.hidePassword')
                        : t('signin.showPassword')
                    }
                    onClick={() => setShowPassword((shown) => !shown)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="si-actions">
                <button type="submit" className="si-submit" disabled={busy}>
                  {t('sync.signIn')} <span aria-hidden="true">↗</span>
                </button>
                <button type="button" className="si-guest" onClick={onGuest}>
                  {t('signin.guest')}
                </button>
              </div>
              <p className="si-guest-hint">{t('signin.guestHint')}</p>
            </form>
          )}

          <p
            className={notice?.ok === false ? 'si-status error' : 'si-status'}
            aria-live="polite"
          >
            {notice?.text}
          </p>

          {!showProject && (
            <p className="si-signup">
              {t('signin.newHere')}{' '}
              <button
                type="button"
                className="si-link"
                disabled={busy}
                onClick={signUp}
              >
                {t('sync.signUp')}
              </button>
            </p>
          )}

          {!showProject && (
            <p className="si-project">
              {t('sync.project', { url: status.url ?? '' })} ·{' '}
              <button
                type="button"
                className="si-link"
                onClick={() => setEditingProject(true)}
              >
                {t('sync.changeProject')}
              </button>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
