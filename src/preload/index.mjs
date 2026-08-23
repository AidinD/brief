/**
 * The bridge between the renderer and the main process.
 *
 * One function for everything Brief can do, plus the window buttons from keel.
 * Same split as Tend: `invoke` goes through main's whitelist, and window chrome
 * comes from the shared layer because it is not an operation on the data.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { windowControlsBridge } from 'keel/window';

contextBridge.exposeInMainWorld('brief', {
  /**
   * @param {string} name Operation name.
   * @param {Record<string, any>} [args]
   * @returns {Promise<any>}
   */
  invoke: (name, args) => ipcRenderer.invoke('brief:invoke', name, args ?? {}),

  /**
   * Fires when brief.json is replaced on disk. Returns its own unsubscribe, so
   * a caller never has to remember the handler it passed.
   *
   * @param {() => void} callback
   * @returns {() => void}
   */
  onChanged: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('brief:changed', handler);
    return () => ipcRenderer.removeListener('brief:changed', handler);
  },

  ...windowControlsBridge(ipcRenderer)
});
