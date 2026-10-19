import { useCallback, useEffect, useState } from 'react';
import type {
  Backdrop,
  ImportReport,
  Language,
  Session,
  Theme,
} from '../shared/api';
import type { CustomColors } from '../shared/palette';
import { cleanError } from './format';
import { I18nProvider } from './i18n/i18n';
import { InboxPage } from './pages/InboxPage';
import { LibraryPage } from './pages/LibraryPage';
import { MistakesPage } from './pages/MistakesPage';
import { VocabPage } from './pages/VocabPage';
import { SettingsPage } from './pages/SettingsPage';
import { TodayPage } from './pages/TodayPage';
import { Sidebar, type Page } from './Sidebar';
import { TestRunner } from './TestRunner';
import { SkinBackdrop } from './SkinBackdrop';
import { UpdateBanner } from './updates';
import { applyTheme } from './theme';

type Skin = {
  theme: Theme;
  colors?: CustomColors;
  backdrop?: Backdrop;
  picture?: string | null;
};

export function App() {
  const [language, setLanguage] = useState<Language | null>(null);
  const [skin, setSkin] = useState<Skin>({ theme: 'default' });
  const [page, setPage] = useState<Page>('today');
  const [session, setSession] = useState<Session | null>(null);
  const [claudeAvailable, setClaudeAvailable] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<ImportReport | null>(null);
  // Bumped when a sync brings in changes, so the open page reloads its data.
  const [synced, setSynced] = useState(0);

  useEffect(() => window.kotoba.onSynced(() => setSynced((n) => n + 1)), []);

  useEffect(() => {
    window.kotoba
      .getSettings()
      .then((settings) => {
        setLanguage(settings.language);
        setSkin({
          theme: settings.theme,
          colors: settings.customColors,
          backdrop: settings.backdrop,
        });
        return window.kotoba.getSkinPicture();
      })
      .then((picture) => setSkin((current) => ({ ...current, picture })))
      .catch(() => setLanguage('en'));
    window.kotoba
      .claudeStatus()
      .then((status) => setClaudeAvailable(status.found));
  }, []);

  useEffect(() => {
    applyTheme(skin.theme, skin.colors);
  }, [skin]);

  const changeSkin = useCallback(
    (
      theme: Theme,
      colors?: CustomColors,
      backdrop?: Backdrop,
      picture?: string | null,
    ) => setSkin({ theme, colors, backdrop, picture }),
    [],
  );

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
      {skin.theme === 'custom' && skin.colors && (
        <SkinBackdrop backdrop={skin.backdrop} picture={skin.picture} />
      )}
      {session ? (
        <TestRunner session={session} onExit={exitSession} />
      ) : (
        <div className="shell">
          <Sidebar current={page} onSelect={setPage} />
          <main className="content" key={synced}>
            <UpdateBanner />
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
            {page === 'vocab' && <VocabPage />}
            {page === 'mistakes' && <MistakesPage />}
            {page === 'library' && <LibraryPage />}
            {page === 'inbox' && <InboxPage />}
            {page === 'settings' && (
              <SettingsPage
                onLanguageChange={setLanguage}
                onThemeChange={changeSkin}
              />
            )}
          </main>
        </div>
      )}
    </I18nProvider>
  );
}
