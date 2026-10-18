import type { CSSProperties } from 'react';
import type { Backdrop } from '../shared/api';

type Props = { backdrop?: Backdrop; picture?: string | null };

/** The custom skin's picture behind the app, if the learner turned it on. */
export function SkinBackdrop({ backdrop, picture }: Props) {
  if (!backdrop || backdrop.mode === 'off' || !picture) return null;
  const style = {
    backgroundImage: `url("${picture}")`,
    '--backdrop-dim': backdrop.dim / 100,
  } as CSSProperties;
  return (
    <div
      className={`skin-backdrop skin-backdrop-${backdrop.mode}`}
      style={style}
      aria-hidden="true"
    />
  );
}
