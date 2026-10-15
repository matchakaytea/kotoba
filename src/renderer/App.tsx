import { useCallback, useEffect, useState } from 'react';
import type { ImportReport, Language, Session, Theme } from '../shared/api';
import { cleanError } from './format';
import { I18nProvider } from './i18n/i18n';
import { InboxPage } from './pages/InboxPage';
import { LibraryPage } from './pages/LibraryPage';
import { MistakesPage } from './pages/MistakesPage';
import { SettingsPage } from './pages/SettingsPage';
import { TodayPage } from './pages/TodayPage';
import { Sidebar, type Page } from './Sidebar';
import { TestRunner } from './TestRunner';

export function App() {
  const [language, setLanguage] = useState<Language | null>(null);
  const [theme, setTheme] = useState<Theme>('default');
  const [page, setPage] = useState<Page>('today');
  const [session, setSession] = useState<Session | null>(null);
  const [claudeAvailable, setClaudeAvailable] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<ImportReport | null>(null);

  useEffect(() => {
    window.kotoba
      .getSettings()
      .then((settings) => {
        setLanguage(settings.language);
        setTheme(settings.theme);
      })
      .catch(() => setLanguage('en'));
    window.kotoba
      .claudeStatus()
      .then((status) => setClaudeAvailable(status.found));
  }, []);

  useEffect(() => {
    if (theme === 'default') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

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

  if (!language) return null;

  return (
    <I18nProvider language={language}>
      {session ? (
        <TestRunner session={session} onExit={exitSession} />
      ) : (
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
            {page === 'settings' && (
              <SettingsPage
                onLanguageChange={setLanguage}
                onThemeChange={setTheme}
              />
            )}
          </main>
        </div>
      )}
    </I18nProvider>
  );
}
