import { useEffect, useState, type FormEvent } from 'react';
import { Settings } from '../../shared/api';
import { cleanError } from '../format';

export function SettingsPage() {
  const [level, setLevel] = useState('');
  const [topics, setTopics] = useState('');
  const [questionCount, setQuestionCount] = useState(15);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  useEffect(() => {
    window.kotoba.getSettings().then((settings) => {
      setLevel(settings.level);
      setTopics(settings.topics.join(', '));
      setQuestionCount(settings.questionCount);
      setLoaded(true);
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = Settings.safeParse({
      level,
      topics: topics
        .split(/[,、]/)
        .map((topic) => topic.trim())
        .filter(Boolean),
      questionCount,
    });
    if (!parsed.success) {
      setStatus({
        ok: false,
        text: 'Add a level and at least one topic. Questions per test can be 5 to 40.',
      });
      return;
    }
    try {
      await window.kotoba.saveSettings(parsed.data);
      setStatus({ ok: true, text: 'Saved. The next test will use these.' });
    } catch (e) {
      setStatus({ ok: false, text: cleanError(e) });
    }
  }

  if (!loaded) return null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="page-sub">
            What Claude should aim for when it writes your tests.
          </p>
        </div>
      </header>

      <form className="form" onSubmit={save} onChange={() => setStatus(null)}>
        <label className="field">
          <span className="field-label">Level</span>
          <input
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            placeholder="around JLPT N2"
          />
          <span className="field-hint">
            Free text, for example “around JLPT N3” or “B1, strong reading”.
          </span>
        </label>

        <label className="field">
          <span className="field-label">Topics</span>
          <input
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="IT, workplace, travel"
          />
          <span className="field-hint">Separate topics with commas.</span>
        </label>

        <label className="field">
          <span className="field-label">Questions per test</span>
          <input
            type="number"
            min={5}
            max={40}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="input-short"
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="primary">
            Save settings
          </button>
          {status && (
            <span
              className={status.ok ? 'form-status ok' : 'form-status error'}
            >
              {status.text}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
