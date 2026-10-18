import { Fragment, useEffect, useState } from 'react';
import type {
  VocabEntry,
  VocabPage as Page,
  VocabQuery,
} from '../../shared/api';
import { parseFurigana } from '../../shared/furigana';
import type { Language } from '../../shared/languages';
import { useI18n } from '../i18n/i18n';

const PAGE_SIZE = 100;
type Level = NonNullable<VocabQuery['level']>;
const LEVELS: (Level | undefined)[] = [undefined, 5, 4, 3, 2, 1];
const TIERS: (VocabQuery['tier'] | undefined)[] = [
  undefined,
  'high',
  'mid',
  'low',
];

type Meaning = 'en' | 'sc' | 'tc';

// Definitions come in English, Simplified and Traditional Chinese; Korean
// falls back to Simplified Chinese.
function meaningFor(language: Language): Meaning {
  if (language === 'en') return 'en';
  return language === 'zh-Hant' ? 'tc' : 'sc';
}

function meaningText(entry: VocabEntry, meaning: Meaning): string {
  if (meaning === 'en') return entry.meaningEn;
  return meaning === 'tc' ? entry.meaningTc : entry.meaningSc;
}

const OTHER_MEANINGS: { meaning: Meaning; label: string }[] = [
  { meaning: 'en', label: 'English' },
  { meaning: 'sc', label: '简体' },
  { meaning: 'tc', label: '繁體' },
];

export function VocabPage() {
  const { t, language } = useI18n();
  const meaning = meaningFor(language);
  const [level, setLevel] = useState<Level | undefined>(undefined);
  const [tier, setTier] = useState<VocabQuery['tier']>(undefined);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [page, setPage] = useState<Page | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    window.kotoba
      .searchVocab({
        level,
        tier,
        search: search || undefined,
        offset: 0,
        limit,
      })
      .then((result) => {
        if (active) setPage(result);
      });
    return () => {
      active = false;
    };
  }, [level, tier, search, limit]);

  function reset(next: () => void) {
    next();
    setLimit(PAGE_SIZE);
    setOpen(null);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('vocab.title')}</h1>
          <p className="page-sub">{t('vocab.sub')}</p>
        </div>
      </header>

      <div className="word-filters">
        <span className="segmented">
          {LEVELS.map((option) => (
            <button
              key={option ?? 'all'}
              className={option === level ? 'active' : ''}
              aria-pressed={option === level}
              onClick={() => reset(() => setLevel(option))}
            >
              {option ? `N${option}` : t('words.all')}
            </button>
          ))}
        </span>
        <span className="segmented">
          {TIERS.map((option) => (
            <button
              key={option ?? 'any'}
              className={option === tier ? 'active' : ''}
              aria-pressed={option === tier}
              onClick={() => reset(() => setTier(option))}
            >
              {option ? t(`vocab.tier.${option}`) : t('vocab.anyTier')}
            </button>
          ))}
        </span>
        <input
          type="search"
          className="word-search"
          value={search}
          placeholder={t('vocab.search')}
          onChange={(e) => reset(() => setSearch(e.target.value))}
        />
      </div>

      {page && page.total === 0 && <p className="empty">{t('words.empty')}</p>}

      {page && page.entries.length > 0 && (
        <table className="table vocab-table">
          <thead>
            <tr>
              <th>{t('words.word')}</th>
              <th>{t('words.reading')}</th>
              <th>{t('vocab.pos')}</th>
              <th>{t('vocab.meaning')}</th>
            </tr>
          </thead>
          <tbody>
            {page.entries.map((entry) => (
              <Fragment key={entry.id}>
                <tr
                  className="vocab-row"
                  onClick={() => setOpen(open === entry.id ? null : entry.id)}
                  aria-expanded={open === entry.id}
                >
                  <td lang="ja" className="cell-prompt">
                    {entry.expression}
                    <span className="pitch">{entry.pitch}</span>
                  </td>
                  <td lang="ja" className="cell-muted">
                    {entry.reading}
                    {entry.origin && (
                      <span className="word-note">{entry.origin}</span>
                    )}
                  </td>
                  <td className="cell-muted">{entry.partOfSpeech}</td>
                  <td>{meaningText(entry, meaning)}</td>
                </tr>
                {open === entry.id && (
                  <tr className="vocab-detail">
                    <td colSpan={4}>
                      <VocabDetail entry={entry} meaning={meaning} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      {page && page.total > page.entries.length && (
        <button
          className="show-more"
          onClick={() => setLimit(limit + PAGE_SIZE)}
        >
          {t('words.showMore', { count: page.total - page.entries.length })}
        </button>
      )}

      <p className="page-footer">{t('vocab.credit')}</p>
    </div>
  );
}

function VocabDetail({
  entry,
  meaning,
}: {
  entry: VocabEntry;
  meaning: Meaning;
}) {
  // The other definitions, skipping any that read the same as one already
  // shown (Simplified and Traditional are often identical).
  const seen = new Set([meaningText(entry, meaning)]);
  const others = OTHER_MEANINGS.filter((other) => {
    const text = meaningText(entry, other.meaning);
    if (seen.has(text)) return false;
    seen.add(text);
    return true;
  });
  return (
    <div className="vocab-detail-body">
      {entry.note && <p className="vocab-note">{entry.note}</p>}
      {others.map((other) => (
        <p key={other.meaning} className="cell-muted">
          {other.label}：{meaningText(entry, other.meaning)}
        </p>
      ))}
      {entry.examples.map((example, i) => (
        <div key={i} className="vocab-example">
          <p lang="ja" className="vocab-sentence">
            {parseFurigana(example.furigana).map((part, j) =>
              part.ruby ? (
                <ruby key={j} className={part.target ? 'target' : undefined}>
                  {part.text}
                  <rt>{part.ruby}</rt>
                </ruby>
              ) : (
                <span key={j} className={part.target ? 'target' : undefined}>
                  {part.text}
                </span>
              ),
            )}
          </p>
          <p className="cell-muted">
            {meaning === 'tc' ? example.tc : example.sc}
          </p>
        </div>
      ))}
    </div>
  );
}
