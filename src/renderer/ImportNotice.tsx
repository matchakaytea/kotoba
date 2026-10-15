import type { ImportReport } from '../shared/api';
import { useI18n } from './i18n/i18n';

type Props = {
  report: ImportReport;
  onDismiss: () => void;
};

export function ImportNotice({ report, onDismiss }: Props) {
  const { t } = useI18n();
  if (report.imported.length === 0 && report.rejected.length === 0) {
    return null;
  }
  return (
    <div className="notice">
      <button
        className="notice-dismiss"
        aria-label={t('import.dismiss')}
        onClick={onDismiss}
      >
        ×
      </button>
      {report.imported.map((item, i) => (
        <p key={`ok-${i}`} className="notice-ok">
          ✓ {t('import.imported', { title: item.title, count: item.questions })}
        </p>
      ))}
      {report.rejected.map((item, i) => (
        <details key={`bad-${i}`} className="notice-rejected">
          <summary>
            ✗{' '}
            {t('import.rejected', {
              file: item.file,
              count: item.errors.length,
            })}
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
