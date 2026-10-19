import { useEffect, useState } from 'react';
import type { UpdateState } from '../shared/api';
import { useI18n } from './i18n/i18n';

function useUpdateState(): UpdateState {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  useEffect(() => {
    window.kotoba.getUpdateState().then(setState);
    return window.kotoba.onUpdateState(setState);
  }, []);
  return state;
}

/** One line saying where the update is, or nothing when there's no news. */
function UpdateProgress({ state }: { state: UpdateState }) {
  const { t } = useI18n();
  const version = state.version ?? '';
  if (state.status === 'downloading') {
    return (
      <p className="cell-muted">
        {t('update.downloading', { version, percent: state.percent ?? 0 })}
      </p>
    );
  }
  if (state.status === 'ready') {
    return <p className="cell-muted">{t('update.restarting')}</p>;
  }
  return null;
}

/** Asks before installing a newer version found in the background. */
export function UpdateBanner() {
  const { t } = useI18n();
  const state = useUpdateState();
  const [later, setLater] = useState<string | null>(null);

  const offered = state.status === 'available' && state.version !== later;
  const busy = state.status === 'downloading' || state.status === 'ready';
  if (!offered && !busy) return null;

  return (
    <div className="notice update-banner" role="status">
      {offered ? (
        <>
          <p>
            <strong>{t('update.ask', { version: state.version ?? '' })}</strong>{' '}
            <span className="cell-muted">{t('update.keepsData')}</span>
          </p>
          <div className="form-actions">
            <button
              className="primary"
              onClick={() => window.kotoba.installUpdate()}
            >
              {t('update.install')}
            </button>
            <button onClick={() => setLater(state.version ?? null)}>
              {t('update.later')}
            </button>
          </div>
        </>
      ) : (
        <UpdateProgress state={state} />
      )}
    </div>
  );
}

/** The Updates section of Settings, with a button to check now. */
export function UpdatePanel() {
  const { t } = useI18n();
  const state = useUpdateState();
  const [checked, setChecked] = useState(false);

  const check = async () => {
    setChecked(true);
    await window.kotoba.checkForUpdates();
  };
  const version = state.version ?? '';

  return (
    <section className="data-panel">
      <h2>{t('update.title')}</h2>
      {state.current && (
        <p className="page-sub">
          {t('update.current', { version: state.current })}
        </p>
      )}
      {state.status === 'available' ? (
        <>
          <p>
            {t('update.ask', { version })}{' '}
            <span className="cell-muted">{t('update.keepsData')}</span>
          </p>
          <div className="form-actions">
            <button
              className="primary"
              onClick={() => window.kotoba.installUpdate()}
            >
              {t('update.install')}
            </button>
          </div>
        </>
      ) : (
        <>
          <UpdateProgress state={state} />
          {checked && state.status === 'none' && (
            <p className="form-status ok">{t('update.none')}</p>
          )}
          {state.status === 'unsupported' && checked && (
            <p className="cell-muted">{t('update.unsupported')}</p>
          )}
          {state.status === 'error' && (
            <p className="form-status error">
              {t('update.failed', { error: state.error ?? '' })}
            </p>
          )}
          <div className="form-actions">
            <button
              disabled={
                state.status === 'checking' ||
                state.status === 'downloading' ||
                state.status === 'ready'
              }
              onClick={check}
            >
              {state.status === 'checking'
                ? t('update.checking')
                : t('update.check')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
