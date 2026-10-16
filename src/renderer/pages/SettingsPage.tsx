import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  LANGUAGES,
  Settings,
  TARGET_LANGUAGES,
  THEMES,
  type Language,
  type Theme,
} from '../../shared/api';
import type { CustomColors, Swatch } from '../../shared/palette';
import { suggestColors } from '../../shared/palette';
import { CustomSkinPanel } from '../CustomSkinPanel';
import { cleanError } from '../format';
import { useI18n } from '../i18n/i18n';

type Status = { ok: true } | { ok: false; error: string | null };

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
type LevelChoice = (typeof JLPT_LEVELS)[number] | 'custom';

function jlptLevel(choice: (typeof JLPT_LEVELS)[number]): string {
  return `around JLPT ${choice}`;
}

function levelChoiceOf(level: string): LevelChoice {
  return JLPT_LEVELS.find((choice) => jlptLevel(choice) === level) ?? 'custom';
}

const NATIVE_NAMES: Record<(typeof TARGET_LANGUAGES)[number]['code'], string> =
  {
    ja: '日本語',
    ko: '한국어',
    zh: '中文',
    en: 'English',
  };

type Props = {
  onLanguageChange: (language: Language) => void;
  onThemeChange: (theme: Theme, colors?: CustomColors) => void;
};

export function SettingsPage({ onLanguageChange, onThemeChange }: Props) {
  const { t } = useI18n();
  const [language, setLanguage] = useState<Language>('en');
  const [savedLanguage, setSavedLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('default');
  const [savedTheme, setSavedTheme] = useState<Theme>('default');
  const [colors, setColors] = useState<CustomColors | undefined>();
  const [savedColors, setSavedColors] = useState<CustomColors | undefined>();
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [picture, setPicture] = useState<string | null>(null);
  const [level, setLevel] = useState('');
  const [levelChoice, setLevelChoice] = useState<LevelChoice>('N2');
  const [topics, setTopics] = useState('');
  const [questionCount, setQuestionCount] = useState(15);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const savedRef = useRef({
    language: savedLanguage,
    theme: savedTheme,
    colors: savedColors,
  });
  savedRef.current = {
    language: savedLanguage,
    theme: savedTheme,
    colors: savedColors,
  };

  useEffect(() => {
    window.kotoba.getSettings().then((settings) => {
      setLanguage(settings.language);
      setSavedLanguage(settings.language);
      setTheme(settings.theme);
      setSavedTheme(settings.theme);
      setColors(settings.customColors);
      setSavedColors(settings.customColors);
      if (settings.customColors) {
        setSwatches([
          { hex: settings.customColors.base, share: 1 },
          { hex: settings.customColors.accent, share: 0 },
        ]);
      }
      setLevel(settings.level);
      setLevelChoice(levelChoiceOf(settings.level));
      setTopics(settings.topics.join(', '));
      setQuestionCount(settings.questionCount);
      setLoaded(true);
    });
    return () => {
      onLanguageChange(savedRef.current.language);
      onThemeChange(savedRef.current.theme, savedRef.current.colors);
    };
  }, [onLanguageChange, onThemeChange]);

  function previewLanguage(next: Language) {
    setLanguage(next);
    onLanguageChange(next);
  }

  function previewTheme(next: Theme, nextColors = colors) {
    setTheme(next);
    setColors(nextColors);
    onThemeChange(next, nextColors);
  }

  function applySwatches(found: Swatch[], dataUrl: string) {
    setPicture(dataUrl);
    setSwatches(found);
    previewTheme('custom', suggestColors(found));
  }

  function chooseLevel(choice: LevelChoice) {
    setLevelChoice(choice);
    if (choice === 'custom') {
      if (levelChoiceOf(level) !== 'custom') setLevel('');
    } else {
      setLevel(jlptLevel(choice));
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = Settings.safeParse({
      language,
      theme,
      ...(colors ? { customColors: colors } : {}),
      targetLanguage: 'ja',
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
    if (theme === 'custom' && !colors) {
      setStatus({ ok: false, error: t('custom.needPicture') });
      return;
    }
    try {
      const saved = await window.kotoba.saveSettings(parsed.data);
      setSavedLanguage(saved.language);
      setSavedTheme(saved.theme);
      setSavedColors(saved.customColors);
      onLanguageChange(saved.language);
      onThemeChange(saved.theme, saved.customColors);
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
        <div className="field-row">
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
            <span className="field-label">{t('settings.theme')}</span>
            <span className="select input-medium">
              <select
                value={theme}
                onChange={(e) => previewTheme(e.target.value as Theme)}
              >
                {THEMES.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code === 'default'
                      ? t('settings.themeDefault')
                      : option.code === 'custom'
                        ? t('settings.themeCustom')
                        : option.name}
                  </option>
                ))}
              </select>
            </span>
            <span className="field-hint">
              {theme !== savedTheme ||
              JSON.stringify(colors) !== JSON.stringify(savedColors)
                ? t('settings.themeUnsaved')
                : t('settings.themeHint')}
            </span>
          </label>
        </div>

        {theme === 'custom' && (
          <CustomSkinPanel
            colors={colors}
            swatches={swatches}
            picture={picture}
            onPicture={applySwatches}
            onChange={(next) => previewTheme('custom', next)}
          />
        )}

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="target-language">
              {t('settings.targetLanguage')}
            </label>
            <span className="select input-medium">
              <select id="target-language" value="ja" onChange={() => {}}>
                {TARGET_LANGUAGES.map((target) => {
                  const name = t(`target.${target.code}`);
                  const native = NATIVE_NAMES[target.code];
                  return (
                    <option
                      key={target.code}
                      value={target.code}
                      disabled={!target.available}
                    >
                      {name === native ? name : `${name} · ${native}`}
                      {!target.available && ` ${t('target.comingSoon')}`}
                    </option>
                  );
                })}
              </select>
            </span>
            <span className="field-hint">{t('settings.targetHint')}</span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="level">
              {t('settings.level')}
            </label>
            <span className="select input-medium">
              <select
                id="level"
                value={levelChoice}
                onChange={(e) => chooseLevel(e.target.value as LevelChoice)}
              >
                {JLPT_LEVELS.map((jlpt) => (
                  <option key={jlpt} value={jlpt}>
                    {jlpt} · {t(`level.${jlpt}`)}
                  </option>
                ))}
                <option value="custom">{t('level.custom')}</option>
              </select>
            </span>
            {levelChoice === 'custom' && (
              <input
                aria-label={t('settings.level')}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="B1, strong reading"
                autoFocus
              />
            )}
            <span className="field-hint">
              {levelChoice === 'custom'
                ? t('settings.levelCustomHint')
                : t('settings.levelHint')}
            </span>
          </div>
        </div>

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
