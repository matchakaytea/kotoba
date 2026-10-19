import { createContext, useContext } from 'react';
import { useI18n } from './i18n/i18n';

type Account = {
  signedIn: boolean;
  /** Opens the sign-in page. */
  openSignIn(): void;
  /** Reads the sign-in state again, after signing in or out. */
  refresh(): Promise<void>;
};

export const AccountContext = createContext<Account>({
  signedIn: false,
  openSignIn: () => {},
  refresh: async () => {},
});

export const useAccount = () => useContext(AccountContext);

/** Shown on every page while nothing is being saved. */
export function GuestBanner() {
  const { t } = useI18n();
  const { signedIn, openSignIn } = useAccount();
  if (signedIn) return null;
  return (
    <div className="notice guest-banner" role="status">
      <span>{t('guest.banner')}</span>
      <button className="primary" onClick={openSignIn}>
        {t('sync.signIn')}
      </button>
    </div>
  );
}
