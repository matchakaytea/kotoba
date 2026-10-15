import { useState } from 'react';
import type { ImportReport } from '../../shared/api';
import { cleanError } from '../format';
import { useI18n } from '../i18n/i18n';
import type { MessageKey } from '../i18n/messages';
import { ImportNotice } from '../ImportNotice';

export function InboxPage() {
  const { t } = useI18n();
  const [report, setReport] = useState<ImportReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setError(cleanError(e));
    }
  }

  async function dismissReport() {
    await window.kotoba.dismissImportReport();
    setReport(null);
  }

  const steps: { step: 1 | 2 | 3; action: () => Promise<void> }[] = [
    {
      step: 1,
      action: async () => {
        await window.kotoba.copyBrief();
        setMessage(t('inbox.copied'));
      },
    },
    { step: 2, action: () => window.kotoba.openInbox() },
    {
      step: 3,
      action: async () => setReport(await window.kotoba.importInbox()),
    },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('inbox.title')}</h1>
          <p className="page-sub">{t('inbox.sub')}</p>
        </div>
      </header>

      <ol className="steps">
        {steps.map(({ step, action }) => (
          <li key={step}>
            <div>
              <h2>{t(`inbox.step${step}.title` as MessageKey)}</h2>
              <p>{t(`inbox.step${step}.body` as MessageKey)}</p>
            </div>
            <button onClick={() => run(action)}>
              {t(`inbox.step${step}.button` as MessageKey)}
            </button>
          </li>
        ))}
      </ol>

      {message && <p className="notice notice-info">{message}</p>}
      {error && <p className="notice error">{error}</p>}
      {report &&
        (report.imported.length === 0 && report.rejected.length === 0 ? (
          <p className="notice notice-info">{t('inbox.noNew')}</p>
        ) : (
          <ImportNotice report={report} onDismiss={dismissReport} />
        ))}
    </div>
  );
}
