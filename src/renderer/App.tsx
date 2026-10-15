import { useState } from 'react';
import type { Session } from '../shared/api';
import { TestRunner } from './TestRunner';
import { TodayScreen } from './TodayScreen';

export function App() {
  const [session, setSession] = useState<Session | null>(null);

  async function start() {
    setSession(await window.kotoba.getSession());
  }

  if (session && session.items.length > 0) {
    return <TestRunner session={session} onExit={() => setSession(null)} />;
  }
  return <TodayScreen onStart={start} />;
}
