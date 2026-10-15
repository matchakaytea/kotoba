import { useState } from 'react';
import type { ImportReport } from '../../shared/api';
import { cleanError } from '../format';
import { ImportNotice } from '../ImportNotice';

export function InboxPage() {
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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Inbox</h1>
          <p className="page-sub">
            Add tests by hand: from a chat with Claude, written yourself, or
            shared by someone else. Any valid test file in the inbox folder is
            imported.
          </p>
        </div>
      </header>

      <ol className="steps">
        <li>
          <div>
            <h2>Copy the brief</h2>
            <p>
              Your due words, recent mistakes, level and topics, plus the rules
              for the test format.
            </p>
          </div>
          <button
            onClick={() =>
              run(async () => {
                await window.kotoba.copyBrief();
                setMessage('Brief copied to the clipboard.');
              })
            }
          >
            Copy brief
          </button>
        </li>
        <li>
          <div>
            <h2>Save the reply in the inbox</h2>
            <p>
              Paste the brief into Claude, then save its reply as a{' '}
              <code>.json</code> file in the inbox folder.
            </p>
          </div>
          <button onClick={() => run(() => window.kotoba.openInbox())}>
            Open inbox folder
          </button>
        </li>
        <li>
          <div>
            <h2>Import it</h2>
            <p>
              Files are also checked every time you open Today. Invalid files
              move to <code>rejected</code>, with the reasons next to them.
            </p>
          </div>
          <button
            onClick={() =>
              run(async () => setReport(await window.kotoba.importInbox()))
            }
          >
            Check inbox
          </button>
        </li>
      </ol>

      {message && <p className="notice notice-info">{message}</p>}
      {error && <p className="notice error">{error}</p>}
      {report &&
        (report.imported.length === 0 && report.rejected.length === 0 ? (
          <p className="notice notice-info">No new files in the inbox.</p>
        ) : (
          <ImportNotice report={report} onDismiss={dismissReport} />
        ))}
    </div>
  );
}
