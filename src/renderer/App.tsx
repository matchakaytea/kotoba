import { useState } from 'react';
import { sampleTest } from './sample-test';
import { TestRunner } from './TestRunner';
import { TodayScreen } from './TodayScreen';

type Screen = 'today' | 'test';

export function App() {
  const [screen, setScreen] = useState<Screen>('today');

  if (screen === 'test') {
    return <TestRunner test={sampleTest} onExit={() => setScreen('today')} />;
  }
  return <TodayScreen test={sampleTest} onStart={() => setScreen('test')} />;
}
