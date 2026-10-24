import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Backdrop,
  ImportReport,
  Language,
  Session,
  StudyPlan,
  SyncStatus,
  Theme,
} from '../shared/api';
import type { CustomColors } from '../shared/palette';
import { AccountContext, GuestBanner } from './account';
import { cleanError } from './format';
import { I18nProvider } from './i18n/i18n';
import { InboxPage } from './pages/InboxPage';
import { LibraryPage } from './pages/LibraryPage';
import { MistakesPage } from './pages/MistakesPage';
import { VocabPage } from './pages/VocabPage';
import { SettingsPage } from './pages/SettingsPage';
import { SignInPage } from './pages/SignInPage';
import { TodayPage } from './pages/TodayPage';
import { Sidebar, type Page } from './Sidebar';
import { TestRunner } from './TestRunner';
import { SkinBackdrop } from './SkinBackdrop';
import { StudyScreen } from './StudyScreen';
import { UpdateBanner } from './updates';
import { applyTheme } from './theme';

// Choosing to go on without signing in lasts until Kotoba is closed; the
// next start asks again.
const GUEST_KEY = 'kotoba-guest';
const AUTO_CHECK_MS = 15 * 60_000;

function readGuest(): boolean {
  try {
    return sessionStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
}

function writeGuest(guest: boolean): void {
  try {
    if (guest) sessionStorage.setItem(GUEST_KEY, '1');
    else sessionStorage.removeItem(GUEST_KEY);
  } catch {
    // Without storage the choice just lasts until the page reloads.
  }
}

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
  const [study, setStudy] = useState<StudyPlan | null>(null);
  const [claudeAvailable, setClaudeAvailable] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<ImportReport | null>(null);
  // Bumped when a sync brings in changes, so the open page reloads its data.
  const [synced, setSynced] = useState(0);

  const [account, setAccount] = useState<SyncStatus | null>(null);
  const [guest, setGuest] = useState(readGuest);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => window.kotoba.onSynced(() => setSynced((n) => n + 1)), []);

  const chooseGuest = useCallback((next: boolean) => {
    setGuest(next);
    writeGuest(next);
  }, []);

  // Signing out goes back to the sign-in page rather than on as a guest.
  const wasSignedIn = useRef(false);
  const refreshAccount = useCallback(async () => {
    const next = await window.kotoba.syncStatus();
    if (wasSignedIn.current && !next.email) chooseGuest(false);
    wasSignedIn.current = Boolean(next.email);
    setAccount(next);
  }, [chooseGuest]);

  useEffect(() => {
    void refreshAccount();
  }, [refreshAccount, synced]);

  // Loads again after a sync, which may bring another device's skin and
  // picture.
  useEffect(() => {
    Promise.all([window.kotoba.getSettings(), window.kotoba.getSkinPicture()])
      .then(([settings, picture]) => {
        setLanguage(settings.language);
        setSkin({
          theme: settings.theme,
          colors: settings.customColors,
          backdrop: settings.backdrop,
          picture,
        });
      })
      .catch(() => setLanguage('en'));
  }, [synced]);

  useEffect(() => {
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
    const [next, settings] = await Promise.all([
      window.kotoba.getSession(),
      window.kotoba.getSettings(),
    ]);
    if (next.items.length === 0) return;
    if (settings.studyFirst) {
      const plan = await window.kotoba.getStudyPlan();
      if (plan.words.length + plan.mistakes.length > 0) {
        setStudy(plan);
        return;
      }
    }
    setSession(next);
  }

  async function startAfterStudy() {
    const next = await window.kotoba.getSession();
    setStudy(null);
    if (next.items.length > 0) setSession(next);
  }

  const generate = useCallback(async (auto = false) => {
    setGenerating(true);
    setAutoGenerating(auto);
    setGenerateError(null);
    try {
      setLastReport(await window.kotoba.generateTest());
    } catch (e) {
      setGenerateError(cleanError(e));
    } finally {
      setGenerating(false);
      setAutoGenerating(false);
    }
  }, []);

  // Makes today's test on its own once a day: when Kotoba opens, and when it
  // is still open after midnight. A failed try waits for the next start.
  const signedIn = Boolean(account?.email);
  const autoTried = useRef<string | null>(null);
  const autoChecking = useRef(false);
  useEffect(() => {
    if (!claudeAvailable || !signedIn) return;
    async function check() {
      const day = new Date().toDateString();
      if (autoTried.current === day || autoChecking.current) return;
      autoChecking.current = true;
      try {
        if (!(await window.kotoba.shouldAutoGenerate())) return;
      } finally {
        autoChecking.current = false;
      }
      autoTried.current = day;
      void generate(true);
    }
    void check();
    const timer = setInterval(check, AUTO_CHECK_MS);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, [claudeAvailable, signedIn, generate]);

  const exitSession = useCallback(() => {
    setSession(null);
    setPage('today');
  }, []);

  const exitStudy = useCallback(() => {
    setStudy(null);
    setPage('today');
  }, []);

  if (!language || !account) return null;

  const accountValue = {
    signedIn,
    openSignIn: () => setSigningIn(true),
    refresh: refreshAccount,
  };

  async function signedInNow() {
    setSigningIn(false);
    chooseGuest(false);
    await refreshAccount();
    // Signing in synced, so every page reloads what it shows.
    setSynced((n) => n + 1);
  }

  return (
    <I18nProvider language={language}>
      {skin.theme === 'custom' && skin.colors && (
        <SkinBackdrop backdrop={skin.backdrop} picture={skin.picture} />
      )}
      <AccountContext.Provider value={accountValue}>
        {signingIn || (!signedIn && !guest) ? (
          <SignInPage
            onSignedIn={signedInNow}
            onGuest={() => {
              chooseGuest(true);
              setSigningIn(false);
            }}
            onBack={signingIn ? () => setSigningIn(false) : undefined}
          />
        ) : study ? (
          <StudyScreen
            plan={study}
            onStart={startAfterStudy}
            onExit={exitStudy}
          />
        ) : session ? (
          <TestRunner session={session} onExit={exitSession} />
        ) : (
          <div className="shell">
            <Sidebar current={page} onSelect={setPage} />
            <main className="content" key={synced}>
              <GuestBanner />
              <UpdateBanner />
              {page === 'today' && (
                <TodayPage
                  onStart={start}
                  generation={{
                    // Tests made while signed out wouldn't be kept.
                    available: claudeAvailable && signedIn,
                    running: generating,
                    auto: autoGenerating,
                    error: generateError,
                    lastReport,
                    run: () => void generate(),
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
      </AccountContext.Provider>
    </I18nProvider>
  );
}
