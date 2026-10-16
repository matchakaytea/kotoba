import { Fragment, useEffect, useState } from 'react';
import type {
  VocabEntry,
  VocabPage as Page,
  VocabQuery,
} from '../../shared/api';
import { parseFurigana } from '../../shared/furigana';
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

export function VocabPage() {
  const { t, language } = useI18n();
  const traditional = language === 'zh-Hant';
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
                  <td>{traditional ? entry.meaningTc : entry.meaningSc}</td>
                </tr>
                {open === entry.id && (
                  <tr className="vocab-detail">
                    <td colSpan={4}>
                      <VocabDetail entry={entry} traditional={traditional} />
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
  traditional,
}: {
  entry: VocabEntry;
  traditional: boolean;
}) {
  return (
    <div className="vocab-detail-body">
      {entry.note && <p className="vocab-note">{entry.note}</p>}
      {!traditional && entry.meaningTc !== entry.meaningSc && (
        <p className="cell-muted">繁體：{entry.meaningTc}</p>
      )}
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
          <p className="cell-muted">{traditional ? example.tc : example.sc}</p>
        </div>
      ))}
    </div>
  );
}
