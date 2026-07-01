import { describe, expect, it } from 'vitest';

import {
  assertSafeIdentifier,
  collectLtiSqlIdentifiers,
  LTI_IDENTIFIER_PATTERN,
  LTI_RESERVED_WORDS,
  LTI_TABLES,
} from '../src/schemaDefinitions.js';

describe('schemaDefinitions', () => {
  it('exports only lowercase snake_case identifiers', () => {
    for (const identifier of collectLtiSqlIdentifiers()) {
      expect(identifier).toMatch(LTI_IDENTIFIER_PATTERN);
      expect(() => assertSafeIdentifier(identifier)).not.toThrow();
    }
  });

  it('uses the lti_ table prefix for every table', () => {
    for (const tableName of Object.values(LTI_TABLES)) {
      expect(tableName.startsWith('lti_')).toBe(true);
      expect(() => assertSafeIdentifier(tableName)).not.toThrow();
    }
  });

  it('does not use bare reserved words as identifiers', () => {
    for (const identifier of collectLtiSqlIdentifiers()) {
      expect(LTI_RESERVED_WORDS.has(identifier)).toBe(false);
    }
  });
});
