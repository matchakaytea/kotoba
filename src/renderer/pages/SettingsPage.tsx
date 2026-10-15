import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LANGUAGES, Settings, type Language } from '../../shared/api';
import { cleanError } from '../format';
import { useI18n } from '../i18n/i18n';

type Status = { ok: true } | { ok: false; error: string | null };

type Props = {
  onLanguageChange: (language: Language) => void;
};

export function SettingsPage({ onLanguageChange }: Props) {
  const { t } = useI18n();
  const [language, setLanguage] = useState<Language>('en');
  const [savedLanguage, setSavedLanguage] = useState<Language>('en');
  const [level, setLevel] = useState('');
  const [topics, setTopics] = useState('');
  const [questionCount, setQuestionCount] = useState(15);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const savedLanguageRef = useRef<Language>('en');
  savedLanguageRef.current = savedLanguage;

  useEffect(() => {
    window.kotoba.getSettings().then((settings) => {
      setLanguage(settings.language);
      setSavedLanguage(settings.language);
      setLevel(settings.level);
      setTopics(settings.topics.join(', '));
      setQuestionCount(settings.questionCount);
      setLoaded(true);
    });
    return () => onLanguageChange(savedLanguageRef.current);
  }, [onLanguageChange]);

  function previewLanguage(next: Language) {
    setLanguage(next);
    onLanguageChange(next);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = Settings.safeParse({
      language,
      level,
      topics: topics
        .split(/[,、，]/)
        .map((topic) => topic.trim())
        .filter(Boolean),
      questionCount,
    });
    if (!parsed.success) {
      setStatus({ ok: false, error: null });
      return;
    }
    try {
      const saved = await window.kotoba.saveSettings(parsed.data);
      setSavedLanguage(saved.language);
      onLanguageChange(saved.language);
      setStatus({ ok: true });
    } catch (e) {
      setStatus({ ok: false, error: cleanError(e) });
    }
  }

  if (!loaded) return null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('settings.title')}</h1>
          <p className="page-sub">{t('settings.sub')}</p>
        </div>
      </header>

      <form className="form" onSubmit={save} onChange={() => setStatus(null)}>
        <label className="field">
          <span className="field-label">{t('settings.language')}</span>
          <span className="select input-medium">
            <select
              value={language}
              onChange={(e) => previewLanguage(e.target.value as Language)}
            >
              {LANGUAGES.map((option) => (
                <option
                  key={option.code}
                  value={option.code}
                  lang={option.code}
                >
                  {option.name}
                </option>
              ))}
            </select>
          </span>
          <span className="field-hint">
            {language !== savedLanguage
              ? t('settings.languageUnsaved')
              : t('settings.languageHint')}
          </span>
        </label>

        <label className="field">
          <span className="field-label">{t('settings.level')}</span>
          <input
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            placeholder="around JLPT N2"
          />
          <span className="field-hint">{t('settings.levelHint')}</span>
        </label>

        <label className="field">
          <span className="field-label">{t('settings.topics')}</span>
          <input
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="IT, workplace, travel"
          />
          <span className="field-hint">{t('settings.topicsHint')}</span>
        </label>

        <label className="field">
          <span className="field-label">{t('settings.questionCount')}</span>
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
            {t('settings.save')}
          </button>
          {status && (
            <span
              className={status.ok ? 'form-status ok' : 'form-status error'}
            >
              {status.ok
                ? t('settings.saved')
                : (status.error ?? t('settings.invalid'))}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
