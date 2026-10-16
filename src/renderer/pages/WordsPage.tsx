import { useEffect, useState } from 'react';
import type {
  JlptLevelSummary,
  WordPage,
  WordQuery,
  WordStatus,
} from '../../shared/api';
import { useI18n } from '../i18n/i18n';

const PAGE_SIZE = 100;
const STATUSES: (WordStatus | undefined)[] = [
  undefined,
  'new',
  'learning',
  'known',
];

export function WordsPage() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<JlptLevelSummary[] | null>(null);
  const [level, setLevel] = useState<WordQuery['level'] | null>(null);
  const [status, setStatus] = useState<WordStatus | undefined>();
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [page, setPage] = useState<WordPage | null>(null);

  useEffect(() => {
    window.kotoba.getJlptSummary().then(setSummary);
    window.kotoba.getSettings().then((settings) => {
      const match = /JLPT N([1-5])/.exec(settings.level);
      setLevel(match ? (Number(match[1]) as WordQuery['level']) : 5);
    });
  }, []);

  useEffect(() => {
    if (level === null) return;
    let active = true;
    window.kotoba
      .getJlptWords({
        level,
        status,
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
  }, [level, status, search, limit]);

  function changeLevel(next: WordQuery['level']) {
    setLevel(next);
    setLimit(PAGE_SIZE);
  }

  if (!summary || level === null) return null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('words.title')}</h1>
          <p className="page-sub">{t('words.sub')}</p>
        </div>
      </header>

      <div className="level-cards">
        {summary.map((item) => (
          <button
            key={item.level}
            className={
              item.level === level ? 'level-card active' : 'level-card'
            }
            aria-pressed={item.level === level}
            onClick={() => changeLevel(item.level)}
          >
            <span className="level-name">N{item.level}</span>
            <span className="level-bar" aria-hidden="true">
              <span
                className="level-bar-known"
                style={{ width: `${(item.known / item.total) * 100}%` }}
              />
              <span
                className="level-bar-learning"
                style={{ width: `${(item.learning / item.total) * 100}%` }}
              />
            </span>
            <span className="level-count">
              {item.known + item.learning} / {item.total}
            </span>
          </button>
        ))}
      </div>

      {summary
        .filter((item) => item.level === level)
        .map((item) => (
          <p key={item.level} className="page-sub">
            {t('words.progress', {
              known: item.known,
              learning: item.learning,
              total: item.total,
            })}
          </p>
        ))}

      <div className="word-filters">
        <span className="segmented">
          {STATUSES.map((option) => (
            <button
              key={option ?? 'all'}
              className={option === status ? 'active' : ''}
              aria-pressed={option === status}
              onClick={() => {
                setStatus(option);
                setLimit(PAGE_SIZE);
              }}
            >
              {t(option ? `words.${option}` : 'words.all')}
            </button>
          ))}
        </span>
        <input
          type="search"
          value={search}
          placeholder={t('words.search')}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(PAGE_SIZE);
          }}
          className="word-search"
        />
      </div>

      {page && page.words.length === 0 && (
        <p className="empty">{t('words.empty')}</p>
      )}

      {page && page.words.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>{t('words.word')}</th>
              <th>{t('words.reading')}</th>
              <th>{t('words.meaning')}</th>
              <th>{t('words.status')}</th>
            </tr>
          </thead>
          <tbody>
            {page.words.map((word) => (
              <tr key={`${word.expression}-${word.readings[0]}`}>
                <td lang="ja" className="cell-prompt">
                  {word.expression}
                  {word.note && <span className="word-note">{word.note}</span>}
                </td>
                <td lang="ja" className="cell-muted">
                  {word.readings.join('、')}
                </td>
                <td>{word.meaning}</td>
                <td>
                  <span className={`tag status-${word.status}`}>
                    {t(`words.${word.status}`)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {page && page.total > page.words.length && (
        <button
          className="show-more"
          onClick={() => setLimit(limit + PAGE_SIZE)}
        >
          {t('words.showMore', { count: page.total - page.words.length })}
        </button>
      )}

      <p className="page-footer">{t('words.credit')}</p>
    </div>
  );
}
