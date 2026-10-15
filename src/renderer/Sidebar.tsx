export type Page = 'today' | 'mistakes' | 'library' | 'inbox' | 'settings';

const PAGES: { page: Page; label: string; japanese: string }[] = [
  { page: 'today', label: 'Today', japanese: '今日' },
  { page: 'mistakes', label: 'Mistakes', japanese: '間違い' },
  { page: 'library', label: 'Library', japanese: '問題集' },
  { page: 'inbox', label: 'Inbox', japanese: '受信箱' },
];

type Props = {
  current: Page;
  onSelect: (page: Page) => void;
};

export function Sidebar({ current, onSelect }: Props) {
  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark">言葉</span>
        <span className="brand-name">Kotoba</span>
      </div>
      <ul className="nav">
        {PAGES.map((item) => (
          <NavItem
            key={item.page}
            {...item}
            current={current}
            onSelect={onSelect}
          />
        ))}
      </ul>
      <ul className="nav nav-bottom">
        <NavItem
          page="settings"
          label="Settings"
          japanese="設定"
          current={current}
          onSelect={onSelect}
        />
      </ul>
    </nav>
  );
}

function NavItem({
  page,
  label,
  japanese,
  current,
  onSelect,
}: {
  page: Page;
  label: string;
  japanese: string;
  current: Page;
  onSelect: (page: Page) => void;
}) {
  return (
    <li>
      <button
        className={page === current ? 'nav-item active' : 'nav-item'}
        aria-current={page === current ? 'page' : undefined}
        onClick={() => onSelect(page)}
      >
        <span>{label}</span>
        <span className="nav-japanese">{japanese}</span>
      </button>
    </li>
  );
}
