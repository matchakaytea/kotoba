import type { ImportReport } from '../shared/api';

type Props = {
  report: ImportReport;
  onDismiss: () => void;
};

export function ImportNotice({ report, onDismiss }: Props) {
  if (report.imported.length === 0 && report.rejected.length === 0) {
    return null;
  }
  return (
    <div className="notice">
      <button
        className="notice-dismiss"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        ×
      </button>
      {report.imported.map((item, i) => (
        <p key={`ok-${i}`} className="notice-ok">
          ✓ Imported “{item.title}” ({item.questions} questions)
        </p>
      ))}
      {report.rejected.map((item, i) => (
        <details key={`bad-${i}`} className="notice-rejected">
          <summary>
            ✗ {item.file} was rejected ({item.errors.length}{' '}
            {item.errors.length === 1 ? 'problem' : 'problems'})
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
