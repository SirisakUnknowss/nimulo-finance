/**
 * Async key-value storage used by the demo store. The web build uses
 * localStorage; the React Native app resolves storage.native.ts instead
 * (AsyncStorage), so the store itself is platform-agnostic.
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // storage may be unavailable (private mode); ignore silently
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
