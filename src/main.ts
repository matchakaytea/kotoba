import { app, BrowserWindow, nativeTheme, screen } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import type { Settings } from './shared/api';
import { buildPalette } from './shared/palette';
import { getSettings, openDatabase } from './main/database';
import { inboxDirs } from './main/inbox';
import { registerIpcHandlers } from './main/ipc';
import { SyncManager } from './main/sync/manager';
import {
  loadWindowState,
  MIN_SIZE,
  saveWindowState,
} from './main/window-state';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Lets a test run use its own data folder instead of the real one.
if (process.env.KOTOBA_USER_DATA) {
  app.setPath('userData', process.env.KOTOBA_USER_DATA);
}

let mainWindow: BrowserWindow | null = null;

const createWindow = (backgroundColor: string) => {
  const stateFile = path.join(app.getPath('userData'), 'window-state.json');
  const state = loadWindowState(
    stateFile,
    screen.getAllDisplays().map((display) => display.workArea),
  );

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    title: 'kotoba',
    autoHideMenuBar: true,
    backgroundColor,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  if (state.maximized) mainWindow.maximize();

  mainWindow.on('close', () => {
    if (!mainWindow) return;
    saveWindowState(stateFile, {
      ...mainWindow.getNormalBounds(),
      maximized: mainWindow.isMaximized(),
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  const userData = app.getPath('userData');
  const db = openDatabase(path.join(userData, 'kotoba.db'));
  app.on('will-quit', () => db.close());
  // Syncs with the learner's Supabase project, if they set one up, and tells
  // the window when it brought in changes from another device.
  const sync = new SyncManager(db, () =>
    mainWindow?.webContents.send('sync:changed'),
  );

  registerIpcHandlers({
    db,
    dirs: inboxDirs(userData),
    workDir: path.join(userData, 'claude-work'),
    dataDir: userData,
    sync,
    isTrustedSender: (event) =>
      mainWindow !== null &&
      event.sender === mainWindow.webContents &&
      event.senderFrame === mainWindow.webContents.mainFrame,
  });

  const background = () => windowBackground(getSettings(db));
  createWindow(background());
  void sync.syncNow();
  sync.startBackgroundSync();
  app.on('browser-window-focus', () => void sync.syncNow());

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(background());
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const SKIN_BACKGROUNDS: Record<string, string> = {
  washi: '#f4efe4',
  sakura: '#fff5f7',
  matcha: '#eef2e6',
  'tokyo-night': '#0f1226',
  mochi: '#fdf8ee',
};

function windowBackground(settings: Settings): string {
  if (settings.theme === 'custom' && settings.customColors) {
    return buildPalette(settings.customColors)['--bg'];
  }
  return (
    SKIN_BACKGROUNDS[settings.theme] ??
    (nativeTheme.shouldUseDarkColors ? '#18181b' : '#f7f7f4')
  );
}
