// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { postgresIntegerToSafeNumber } from '../postgres';

describe('PostgreSQL integer conversion', () => {
  it('converts BIGINT strings without losing cents', () => {
    expect(postgresIntegerToSafeNumber('2147483648', 'balance')).toBe(2_147_483_648);
  });

  it('uses zero for a nullable aggregate', () => {
    expect(postgresIntegerToSafeNumber(null, 'balance')).toBe(0);
  });

  it('rejects values that JavaScript cannot represent exactly', () => {
    expect(() => postgresIntegerToSafeNumber('9007199254740992', 'balance')).toThrow(
      'balance is outside'
    );
  });
});
