/**
 * Next.js Instrumentation Hook — runs before anything else on the server.
 *
 * Problem: Node.js 25 has native localStorage support (via --localstorage-file).
 * Next.js 15 passes this flag without a valid path, so localStorage is defined
 * as a global but localStorage.getItem/setItem throw. Some packages (genkit, etc.)
 * call localStorage at initialization. This polyfill replaces the broken
 * Node.js 25 localStorage with a safe in-memory no-op so SSR doesn't crash.
 */
export async function register() {
  if (typeof localStorage !== 'undefined') {
    try {
      // Test if it's broken
      localStorage.getItem('__test__');
    } catch {
      // Replace with safe in-memory implementation
      const store: Record<string, string> = {};
      const safeStorage: Storage = {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = String(value); },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); },
        key: (index: number) => Object.keys(store)[index] ?? null,
        get length() { return Object.keys(store).length; },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).localStorage = safeStorage;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).sessionStorage = safeStorage;
    }
  }
}
