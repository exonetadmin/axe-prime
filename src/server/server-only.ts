/**
 * Runtime backstop for modules that must never enter a browser bundle.
 * Imports of `node:*`, `pg`, and `next/headers` provide the build-time barrier;
 * this guard also fails closed if a custom bundler bypasses those checks.
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  throw new Error('A server-only module was imported by client-side code');
}

export {};
