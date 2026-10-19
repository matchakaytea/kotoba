import { app } from 'electron';
import electronUpdater from 'electron-updater';
import type { UpdateState } from '../shared/api';

const { autoUpdater } = electronUpdater;

const CHECK_EVERY_MS = 4 * 60 * 60_000;

/**
 * Checks GitHub Releases for a newer Kotoba. Nothing is downloaded until the
 * learner agrees; then it installs over the current copy and restarts. The
 * data folder is separate, so it's kept. Only the installed app updates.
 */
export class Updater {
  private state: UpdateState = { status: 'idle', current: app.getVersion() };

  constructor(private readonly onChange: (state: UpdateState) => void) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on('update-available', (info) =>
      this.set({ status: 'available', version: info.version }),
    );
    autoUpdater.on('update-not-available', () => this.set({ status: 'none' }));
    autoUpdater.on('download-progress', (progress) =>
      this.set({
        status: 'downloading',
        version: this.state.version,
        percent: Math.round(progress.percent),
      }),
    );
    autoUpdater.on('update-downloaded', (info) => {
      this.set({ status: 'ready', version: info.version });
      autoUpdater.quitAndInstall();
    });
  }

  private set(state: UpdateState): void {
    this.state = { ...state, current: app.getVersion() };
    this.onChange(this.state);
  }

  current(): UpdateState {
    return this.state;
  }

  /** Checks now and every few hours while Kotoba is open. */
  start(): void {
    if (!app.isPackaged) return;
    void this.check();
    setInterval(() => {
      // Don't interrupt a download or an offer already on screen.
      if (this.state.status === 'idle' || this.state.status === 'none') {
        void this.check();
      }
    }, CHECK_EVERY_MS);
  }

  async check(): Promise<UpdateState> {
    if (!app.isPackaged) {
      this.set({ status: 'unsupported' });
      return this.state;
    }
    this.set({ status: 'checking' });
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.set({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return this.state;
  }

  /** Downloads the newer version, then installs it and restarts. */
  async install(): Promise<void> {
    if (this.state.status !== 'available') return;
    this.set({
      status: 'downloading',
      version: this.state.version,
      percent: 0,
    });
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.set({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
