import { useCallback, useEffect, useState } from 'react';
import type { ImportReport, Session } from '../shared/api';
import { cleanError } from './format';
import { InboxPage } from './pages/InboxPage';
import { LibraryPage } from './pages/LibraryPage';
import { MistakesPage } from './pages/MistakesPage';
import { SettingsPage } from './pages/SettingsPage';
import { TodayPage } from './pages/TodayPage';
import { Sidebar, type Page } from './Sidebar';
import { TestRunner } from './TestRunner';

export function App() {
  const [page, setPage] = useState<Page>('today');
  const [session, setSession] = useState<Session | null>(null);
  const [claudeAvailable, setClaudeAvailable] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<ImportReport | null>(null);

  useEffect(() => {
    window.kotoba
      .claudeStatus()
      .then((status) => setClaudeAvailable(status.found));
  }, []);

  async function start() {
    const next = await window.kotoba.getSession();
    if (next.items.length > 0) setSession(next);
  }

  async function generate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      setLastReport(await window.kotoba.generateTest());
    } catch (e) {
      setGenerateError(cleanError(e));
    } finally {
      setGenerating(false);
    }
  }

  const exitSession = useCallback(() => {
    setSession(null);
    setPage('today');
  }, []);

  if (session) {
    return <TestRunner session={session} onExit={exitSession} />;
  }

  return (
    <div className="shell">
      <Sidebar current={page} onSelect={setPage} />
      <main className="content">
        {page === 'today' && (
          <TodayPage
            onStart={start}
            generation={{
              available: claudeAvailable,
              running: generating,
              error: generateError,
              lastReport,
              run: generate,
            }}
          />
        )}
        {page === 'mistakes' && <MistakesPage />}
        {page === 'library' && <LibraryPage />}
        {page === 'inbox' && <InboxPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
