import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';

// jose must use Node's Uint8Array realm when Vitest runs under jsdom.
Object.defineProperty(globalThis, 'TextEncoder', {
  configurable: true,
  value: TextEncoder,
});
Object.defineProperty(globalThis, 'TextDecoder', {
  configurable: true,
  value: TextDecoder,
});
