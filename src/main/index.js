/**
 * Electron main process.
 *
 * Opens one window, owns the store, and watches `brief.json` so a brief written
 * while the app is open appears without a reload. That watch is the whole
 * integration story: the generator writes a file, the window notices. There is
 * no server, no port, and nothing for an agent to authenticate against - the
 * same shape that made Jot useful to agents in the first place.
 */

import { BrowserWindow, app, ipcMain, shell } from 'electron';
import { watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// electron-updater is CommonJS, so a named ESM import does not work - the
// default import is the whole module object.
import electronUpdater from 'electron-updater';

import { registerWindowControls } from 'keel/window';

import { resolveDataDir, resolveJotDir } from '../domain/paths.js';
import * as api from '../service/api.js';
import { openStore } from '../storage/store.js';

const { autoUpdater } = electronUpdater;

const here = dirname(fileURLToPath(import.meta.url));
const { dir, source } = resolveDataDir(app.getPath('userData'));
const jot = resolveJotDir();

/** @type {string[]} */
const warnings = [];

/** Last thing the updater said, so the window can show it. */
let updateStatus = 'No update check has run yet.';
let updateListenersAttached = false;

const store = openStore({
  dataDir: dir,
  onWarning: (message) => {
    warnings.push(message);
    console.warn(`[brief] ${message}`);
  }
});

/**
 * Operations the renderer may call.
 *
 * A whitelist rather than a generic bridge, as in Tend. The window buttons are
 * deliberately absent - those come from keel on their own channels, because
 * window chrome is not an operation on the data.
 */
const OPERATIONS = {
  today: () => api.today(store, Date.now()),
  answered: () => api.answered(store),
  answer: (/** @type {any} */ a) => api.answer(store, a.id, a.verdict, Date.now()),
  context: () => api.context({ dataDir: dir, jotDir: jot.dir }),

  openDataDir: async () => {
    const problem = await shell.openPath(dir);
    return problem ? { error: problem } : { opened: dir };
  },

  openExternal: async (/** @type {any} */ a) => {
    const url = String(a.url ?? '');
    // Only http(s). A brief is assembled from links a model found, and a
    // file:// or a shell handler in that list would be a way to make the app
    // open something it was never asked to.
    if (!/^https?:\/\//i.test(url)) {
      return { error: 'Only http and https links open.' };
    }
    await shell.openExternal(url);
    return { opened: url };
  },

  checkForUpdates: () => {
    if (!app.isPackaged) {
      return { error: 'Running from source, so there is no installed copy to update.' };
    }
    checkForUpdates();
    return { checking: true };
  },

  status: () => ({
    dataDir: dir,
    dataDirFrom: source,
    jotDir: jot.dir,
    jotDirFrom: jot.source,
    warnings: warnings.slice(-5),
    version: app.getVersion(),
    packaged: app.isPackaged,
    updateStatus
  })
};

ipcMain.handle('brief:invoke', (_event, name, args) => {
  const op = /** @type {Record<string, (a: any) => any>} */ (OPERATIONS)[name];
  if (!op) {
    return { error: `Unknown operation "${name}".` };
  }
  try {
    return op(args ?? {});
  } catch (err) {
    return { error: `${name} failed: ${err instanceof Error ? err.message : String(err)}` };
  }
});

registerWindowControls({ ipcMain, BrowserWindow });

/** @type {BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
  const window = new BrowserWindow({
    // Narrow on purpose. A brief is a column of prose, and a column of prose
    // stops being readable past about 70 characters - so the window is the
    // measure rather than the screen.
    width: 760,
    height: 900,
    minWidth: 520,
    minHeight: 480,
    show: false,
    frame: false,
    backgroundColor: '#1b1c1f',
    autoHideMenuBar: true,
    title: 'Brief',
    webPreferences: {
      // .mjs, not .js: Electron loads a preload as CommonJS unless the
      // extension says otherwise, regardless of package.json type.
      preload: join(here, '..', 'preload', 'index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  window.loadFile(join(here, '..', 'renderer', 'index.html'));
  mainWindow = window;
  window.on('closed', () => {
    mainWindow = null;
  });
  return window;
}

/**
 * Watch for a new brief.
 *
 * The directory, not the file: `brief.json` is replaced by a rename, so a watch
 * on the file itself stops firing after the first write - the watcher is still
 * holding the old inode. Debounced because a rename produces two events on
 * Windows and the renderer should not redraw twice.
 */
function watchForBriefs() {
  /** @type {NodeJS.Timeout | null} */
  let pending = null;
  try {
    watch(dir, (_event, filename) => {
      if (filename !== 'brief.json') {
        return;
      }
      if (pending !== null) {
        clearTimeout(pending);
      }
      pending = setTimeout(() => {
        pending = null;
        mainWindow?.webContents.send('brief:changed');
      }, 120);
    });
  } catch (err) {
    warnings.push(`Could not watch ${dir} for new briefs: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Check GitHub for a newer release, once, at startup.
 *
 * Never in development: there is no packaged app to replace and the check only
 * produces a confusing error in the log.
 */
function checkForUpdates() {
  if (!app.isPackaged) {
    return;
  }

  if (!updateListenersAttached) {
    updateListenersAttached = true;
    autoUpdater.on('update-available', (info) => {
      updateStatus = `Version ${info.version} is available and downloading.`;
    });
    autoUpdater.on('update-not-available', () => {
      updateStatus = 'You are on the latest version.';
    });
    autoUpdater.on('update-downloaded', (info) => {
      updateStatus = `Version ${info.version} is ready and installs when you quit.`;
    });
    autoUpdater.on('error', (error) => {
      updateStatus = 'Could not reach the update server. Probably offline.';
      console.error('[brief] update check failed', error);
    });
  }

  updateStatus = 'Checking...';
  void autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    updateStatus = 'The update check could not start.';
    console.error('[brief] update check could not start', error);
  });
}

app.whenReady().then(() => {
  console.log(`[brief] data directory: ${dir} (${source})`);
  createWindow();
  watchForBriefs();
  checkForUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
