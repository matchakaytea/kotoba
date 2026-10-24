import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_BACKDROP,
  LANGUAGES,
  TARGET_LANGUAGES,
  THEMES,
  type Backdrop,
  type Language,
  type Settings,
  type Theme,
} from '../../shared/api';
import type { CustomColors, Swatch } from '../../shared/palette';
import { suggestColors } from '../../shared/palette';
import { CustomSkinPanel } from '../CustomSkinPanel';
import { cleanError } from '../format';
import { useI18n } from '../i18n/i18n';
import { DataPanel } from '../DataPanel';
import { SyncPanel } from '../SyncPanel';
import {
  differs,
  draftOf,
  settingsOf,
  type SettingsDraft,
} from '../settings-draft';
import { UpdatePanel } from '../updates';

// Changes save on their own this long after the last edit, so typing a
// topic doesn't save on every key.
const SAVE_DELAY_MS = 600;

type Tab = 'learning' | 'appearance' | 'account' | 'data' | 'about';
// Data and About are about the installed app, so the web version leaves
// them out.
const TABS: Tab[] =
  window.kotoba.platform === 'desktop'
    ? ['learning', 'appearance', 'account', 'data', 'about']
    : ['learning', 'appearance', 'account'];

type Status = 'saving' | 'saved' | 'invalid' | { error: string } | null;

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
  onThemeChange: (
    theme: Theme,
    colors?: CustomColors,
    backdrop?: Backdrop,
    picture?: string | null,
  ) => void;
};

export function SettingsPage({ onLanguageChange, onThemeChange }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('learning');
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [levelChoice, setLevelChoice] = useState<LevelChoice>('N2');
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [picture, setPicture] = useState<string | null>(null);
  const [savedPicture, setSavedPicture] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    Promise.all([
      window.kotoba.getSettings(),
      window.kotoba.getSkinPicture(),
    ]).then(([settings, stored]) => {
      const loaded = draftOf(settings, DEFAULT_BACKDROP);
      setDraft(loaded);
      // Compared in the draft's shape, so just opening Settings saves nothing
      // (a save would make this device's settings the newest everywhere).
      setSaved(settingsOf(loaded) ?? settings);
      setLevelChoice(levelChoiceOf(settings.level));
      if (settings.customColors) {
        setSwatches([
          { hex: settings.customColors.base, share: 1 },
          { hex: settings.customColors.accent, share: 0 },
        ]);
      }
      setPicture(stored);
      setSavedPicture(stored);
    });
  }, []);

  // The app shows the language and skin being chosen straight away.
  useEffect(() => {
    if (!draft) return;
    onLanguageChange(draft.language);
    onThemeChange(draft.theme, draft.colors, draft.backdrop, picture);
  }, [draft, picture, onLanguageChange, onThemeChange]);

  // Saves a valid change shortly after it's made. `pending` holds a save that
  // hasn't run yet, so leaving the page can still make it.
  const pending = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    pending.current = null;
    if (!draft) return;
    const next = settingsOf(draft);
    const pictureChanged = picture !== null && picture !== savedPicture;
    if (!next) {
      setStatus(
        draft.theme === 'custom' && !draft.colors
          ? { error: t('custom.needPicture') }
          : 'invalid',
      );
      return;
    }
    if (!differs(next, saved) && !pictureChanged) return;

    const save = async () => {
      pending.current = null;
      setStatus('saving');
      try {
        if (pictureChanged) {
          await window.kotoba.saveSkinPicture(picture);
          setSavedPicture(picture);
        }
        setSaved(await window.kotoba.saveSettings(next));
        setStatus('saved');
      } catch (e) {
        setStatus({ error: cleanError(e) });
      }
    };
    pending.current = save;
    const timer = setTimeout(save, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, picture, saved, savedPicture, t]);

  // Leaving Settings: make a waiting save now, or, if the last change can't be
  // saved, put the app back to the saved language and skin.
  const latest = useRef({ draft, saved, savedPicture });
  latest.current = { draft, saved, savedPicture };
  useEffect(
    () => () => {
      if (pending.current) {
        void pending.current();
        return;
      }
      const {
        draft: last,
        saved: kept,
        savedPicture: keptPicture,
      } = latest.current;
      if (last && kept && !settingsOf(last)) {
        onLanguageChange(kept.language);
        onThemeChange(
          kept.theme,
          kept.customColors,
          kept.backdrop,
          keptPicture,
        );
      }
    },
    [onLanguageChange, onThemeChange],
  );

  if (!draft) return null;

  const change = (patch: Partial<SettingsDraft>) =>
    setDraft((current) => (current ? { ...current, ...patch } : current));

  function chooseLevel(choice: LevelChoice) {
    setLevelChoice(choice);
    if (choice === 'custom') {
      if (levelChoiceOf(draft!.level) !== 'custom') change({ level: '' });
    } else {
      change({ level: jlptLevel(choice) });
    }
  }

  function applySwatches(found: Swatch[], dataUrl: string) {
    setSwatches(found);
    setPicture(dataUrl);
    change({ theme: 'custom', colors: suggestColors(found) });
  }

  const savable = tab === 'learning' || tab === 'appearance';
  // Easier levels need the JLPT list and a level above N5.
  const easierAvailable =
    draft.wordSource === 'jlpt' &&
    levelChoice !== 'custom' &&
    levelChoice !== 'N5';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('settings.title')}</h1>
          <p className="page-sub">{t('settings.sub')}</p>
        </div>
      </header>

      <div className="settings-tabs" role="tablist">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'active' : undefined}
            onClick={() => setTab(id)}
          >
            {t(`settings.tab.${id}`)}
          </button>
        ))}
      </div>

      {savable && (
        <p className="settings-status" aria-live="polite">
          {status === 'saving' && (
            <span className="form-status">{t('settings.saving')}</span>
          )}
          {status === 'saved' && (
            <span className="form-status ok">{t('settings.saved')}</span>
          )}
          {status === 'invalid' && (
            <span className="form-status error">{t('settings.invalid')}</span>
          )}
          {status && typeof status === 'object' && (
            <span className="form-status error">{status.error}</span>
          )}
        </p>
      )}

      {tab === 'learning' && (
        <div className="form" role="tabpanel">
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
                  value={draft.level}
                  onChange={(e) => change({ level: e.target.value })}
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
            <span className="field-label">{t('settings.wordSource')}</span>
            <span className="select input-medium">
              <select
                value={levelChoice === 'custom' ? 'free' : draft.wordSource}
                disabled={levelChoice === 'custom'}
                onChange={(e) =>
                  change({ wordSource: e.target.value as 'jlpt' | 'free' })
                }
              >
                <option value="jlpt">
                  {t('settings.wordSourceJlpt', {
                    level: levelChoice === 'custom' ? 'N?' : levelChoice,
                  })}
                </option>
                <option value="free">{t('settings.wordSourceFree')}</option>
              </select>
            </span>
            <span className="field-hint">
              {levelChoice === 'custom'
                ? t('settings.wordSourceCustom')
                : t('settings.wordSourceHint')}
            </span>
          </label>

          <label className="field">
            <span className="field-label">{t('settings.topics')}</span>
            <input
              value={draft.topics}
              onChange={(e) => change({ topics: e.target.value })}
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
              value={draft.questionCount}
              onChange={(e) =>
                change({ questionCount: Number(e.target.value) })
              }
              className="input-short"
            />
          </label>

          <fieldset className="field check-group">
            <legend className="field-label">{t('settings.routine')}</legend>
            <Check
              checked={easierAvailable && draft.easierWords}
              disabled={!easierAvailable}
              onChange={(easierWords) => change({ easierWords })}
              label={t('settings.easierWords')}
              hint={t('settings.easierWordsHint')}
            />
            {window.kotoba.platform === 'desktop' && (
              <Check
                checked={draft.autoGenerate}
                onChange={(autoGenerate) => change({ autoGenerate })}
                label={t('settings.autoGenerate')}
                hint={t('settings.autoGenerateHint')}
              />
            )}
            <Check
              checked={draft.studyFirst}
              onChange={(studyFirst) => change({ studyFirst })}
              label={t('settings.studyFirst')}
              hint={t('settings.studyFirstHint')}
            />
          </fieldset>
        </div>
      )}

      {tab === 'appearance' && (
        <div className="form" role="tabpanel">
          <div className="field-row">
            <label className="field">
              <span className="field-label">{t('settings.language')}</span>
              <span className="select input-medium">
                <select
                  value={draft.language}
                  onChange={(e) =>
                    change({ language: e.target.value as Language })
                  }
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
              <span className="field-hint">{t('settings.languageHint')}</span>
            </label>

            <label className="field">
              <span className="field-label">{t('settings.theme')}</span>
              <span className="select input-medium">
                <select
                  value={draft.theme}
                  onChange={(e) => change({ theme: e.target.value as Theme })}
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
              <span className="field-hint">{t('settings.themeHint')}</span>
            </label>
          </div>

          {draft.theme === 'custom' && (
            <CustomSkinPanel
              colors={draft.colors}
              swatches={swatches}
              picture={picture}
              onPicture={applySwatches}
              onChange={(colors) => change({ theme: 'custom', colors })}
              backdrop={draft.backdrop}
              onBackdropChange={(backdrop) => change({ backdrop })}
            />
          )}
        </div>
      )}

      {tab === 'account' && (
        <div className="settings-panel" role="tabpanel">
          <SyncPanel />
        </div>
      )}
      {tab === 'data' && (
        <div className="settings-panel" role="tabpanel">
          <DataPanel />
        </div>
      )}
      {tab === 'about' && (
        <div className="settings-panel" role="tabpanel">
          <UpdatePanel />
        </div>
      )}
    </div>
  );
}

type CheckProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint: string;
};

function Check({ checked, disabled, onChange, label, hint }: CheckProps) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="check-label">{label}</span>
        <span className="field-hint">{hint}</span>
      </span>
    </label>
  );
}
