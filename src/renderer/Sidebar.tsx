import { useI18n } from './i18n/i18n';
import type { MessageKey } from './i18n/messages';

export type Page =
  | 'today'
  | 'vocab'
  | 'mistakes'
  | 'library'
  | 'inbox'
  | 'settings';

type NavEntry = { page: Page; label: MessageKey; japanese: string };

const PAGES: NavEntry[] = [
  { page: 'today', label: 'nav.today', japanese: '今日' },
  { page: 'vocab', label: 'nav.vocab', japanese: '語彙' },
  { page: 'mistakes', label: 'nav.mistakes', japanese: '間違い' },
  { page: 'library', label: 'nav.library', japanese: '問題集' },
  { page: 'inbox', label: 'nav.inbox', japanese: '受信箱' },
];

const SETTINGS: NavEntry = {
  page: 'settings',
  label: 'nav.settings',
  japanese: '設定',
};

type Props = {
  current: Page;
  onSelect: (page: Page) => void;
};

export function Sidebar({ current, onSelect }: Props) {
  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark" lang="ja">
          言葉
        </span>
        <span className="brand-name">Kotoba</span>
      </div>
      <ul className="nav">
        {PAGES.map((entry) => (
          <NavItem
            key={entry.page}
            entry={entry}
            current={current}
            onSelect={onSelect}
          />
        ))}
      </ul>
      <ul className="nav nav-bottom">
        <NavItem entry={SETTINGS} current={current} onSelect={onSelect} />
      </ul>
    </nav>
  );
}

function NavItem({
  entry,
  current,
  onSelect,
}: {
  entry: NavEntry;
  current: Page;
  onSelect: (page: Page) => void;
}) {
  const { t } = useI18n();
  const active = entry.page === current;
  return (
    <li>
      <button
        className={active ? 'nav-item active' : 'nav-item'}
        aria-current={active ? 'page' : undefined}
        onClick={() => onSelect(entry.page)}
      >
        <span>{t(entry.label)}</span>
        <span className="nav-japanese" lang="ja">
          {entry.japanese}
        </span>
      </button>
    </li>
  );
}
