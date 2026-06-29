import { SignJWT, jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';

import {
  importLtiToolKeyPairFromJwk,
  LtiToolKeyPairImportError,
  type LtiToolPrivateJwkInput,
} from '../src/index.js';

const generatePrivateJwk = async (kid = 'test-key'): Promise<LtiToolPrivateJwkInput> => {
  const generatedKey = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );

  if (!('privateKey' in generatedKey)) {
    throw new Error('Expected an RSA key pair');
  }

  return {
    ...(await crypto.subtle.exportKey('jwk', generatedKey.privateKey)),
    kid,
  };
};

describe('LTI tool key pair helpers', () => {
  it('imports an RSA private JWK JSON string into a signing key pair', async () => {
    const privateJwk = await generatePrivateJwk('tool-key-1');

    const result = await importLtiToolKeyPairFromJwk(JSON.stringify(privateJwk));

    expect(result.keyId).toBe('tool-key-1');
    expect(result.keyPair.privateKey.type).toBe('private');
    expect(result.keyPair.publicKey.type).toBe('public');

    const jwt = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'RS256', kid: result.keyId })
      .sign(result.keyPair.privateKey);
    const verified = await jwtVerify(jwt, result.keyPair.publicKey);

    expect(verified.payload.sub).toBe('user-1');
    expect(verified.protectedHeader.kid).toBe('tool-key-1');
  });

  it('imports an RSA private JWK object and trims the key ID', async () => {
    const privateJwk = await generatePrivateJwk('  tool-key-2  ');

    const result = await importLtiToolKeyPairFromJwk(privateJwk);

    expect(result.keyId).toBe('tool-key-2');
  });

  it('rejects invalid JWK JSON without echoing the input', async () => {
    await expect(importLtiToolKeyPairFromJwk('{not-json')).rejects.toMatchObject({
      name: 'LtiToolKeyPairImportError',
      code: 'invalid_private_jwk_json',
      message: 'LTI tool private JWK must be valid JSON',
    });
  });

  it('rejects non-RSA or missing-kid private JWKs', async () => {
    await expect(
      importLtiToolKeyPairFromJwk({ kty: 'RSA', n: 'n', e: 'e', d: 'd' }),
    ).rejects.toMatchObject({
      name: 'LtiToolKeyPairImportError',
      code: 'invalid_private_jwk',
      message: 'LTI tool private JWK must be an RSA private JWK with a kid',
    });
  });

  it('wraps WebCrypto import failures in a typed error', async () => {
    await expect(
      importLtiToolKeyPairFromJwk({
        kty: 'RSA',
        n: 'not-valid-key-material',
        e: 'AQAB',
        d: 'not-valid-key-material',
        kid: 'bad-key',
      }),
    ).rejects.toBeInstanceOf(LtiToolKeyPairImportError);

    await expect(
      importLtiToolKeyPairFromJwk({
        kty: 'RSA',
        n: 'not-valid-key-material',
        e: 'AQAB',
        d: 'not-valid-key-material',
        kid: 'bad-key',
      }),
    ).rejects.toMatchObject({
      code: 'key_import_failed',
      message: 'LTI tool private JWK could not be imported as an RS256 key pair',
    });
  });
});
