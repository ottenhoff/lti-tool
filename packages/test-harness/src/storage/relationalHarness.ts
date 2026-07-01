import type { LTIDynamicRegistrationSession, LTISession } from '@longsightgroup/lti-tool';

export const RELATIONAL_TABLES = [
  'lti_deployments',
  'lti_clients',
  'lti_sessions',
  'lti_nonces',
  'lti_registration_sessions',
] as const;

export type RelationalTable = (typeof RELATIONAL_TABLES)[number];

export type RelationalSeedWriter = {
  resetTable(table: RelationalTable): Promise<void>;
  insertSession(input: RelationalSessionSeed): Promise<void>;
  insertNonce(input: RelationalNonceSeed): Promise<void>;
  insertRegistrationSession(input: RelationalRegistrationSessionSeed): Promise<void>;
};

type RelationalSeedHelpers = {
  readonly seedExpiredSession: (sessionId: string, session: LTISession) => Promise<void>;
  readonly seedActiveSession: (
    sessionId: string,
    payload?: Record<string, unknown>,
  ) => Promise<void>;
  readonly seedExpiredNonce: (nonce: string) => Promise<void>;
  readonly seedActiveNonce: (nonce: string) => Promise<void>;
  readonly seedExpiredRegistrationSession: (
    sessionId: string,
    session: LTIDynamicRegistrationSession,
  ) => Promise<void>;
  readonly seedActiveRegistrationSession: (
    sessionId: string,
    payload?: Record<string, unknown>,
  ) => Promise<void>;
};

type RelationalSessionSeed = {
  readonly sessionId: string;
  readonly payloadJson: string;
  readonly expiresAt: number;
};

type RelationalNonceSeed = {
  readonly nonce: string;
  readonly expiresAt: number;
};

type RelationalRegistrationSessionSeed = {
  readonly sessionId: string;
  readonly payloadJson: string;
  readonly expiresAt: number;
};

export function pastTimestamp(): number {
  return Date.now() - 1_000;
}

export function futureTimestamp(): number {
  return Date.now() + 60_000;
}

export function createRelationalReset(writer: RelationalSeedWriter): () => Promise<void> {
  return async () => {
    for (const table of RELATIONAL_TABLES) {
      await writer.resetTable(table);
    }
  };
}

export function createRelationalSeedHelpers(
  writer: RelationalSeedWriter,
): RelationalSeedHelpers {
  return {
    seedExpiredSession: (sessionId, session) =>
      seedExpiredSession(writer, sessionId, session),
    seedActiveSession: (sessionId, payload) =>
      seedActiveSession(writer, sessionId, payload),
    seedExpiredNonce: (nonce) =>
      writer.insertNonce({ nonce, expiresAt: pastTimestamp() }),
    seedActiveNonce: (nonce) =>
      writer.insertNonce({ nonce, expiresAt: futureTimestamp() }),
    seedExpiredRegistrationSession: (sessionId, session) =>
      seedExpiredRegistrationSession(writer, sessionId, session),
    seedActiveRegistrationSession: (sessionId, payload) =>
      seedActiveRegistrationSession(writer, sessionId, payload),
  };
}

async function seedExpiredSession(
  writer: RelationalSeedWriter,
  sessionId: string,
  session: LTISession,
): Promise<void> {
  const { id: _id, ...sessionData } = session;
  await writer.insertSession({
    sessionId,
    payloadJson: JSON.stringify(sessionData),
    expiresAt: pastTimestamp(),
  });
}

async function seedActiveSession(
  writer: RelationalSeedWriter,
  sessionId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await writer.insertSession({
    sessionId,
    payloadJson: JSON.stringify(payload),
    expiresAt: futureTimestamp(),
  });
}

async function seedExpiredRegistrationSession(
  writer: RelationalSeedWriter,
  sessionId: string,
  session: LTIDynamicRegistrationSession,
): Promise<void> {
  await writer.insertRegistrationSession({
    sessionId,
    payloadJson: JSON.stringify(session),
    expiresAt: pastTimestamp(),
  });
}

async function seedActiveRegistrationSession(
  writer: RelationalSeedWriter,
  sessionId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await writer.insertRegistrationSession({
    sessionId,
    payloadJson: JSON.stringify(payload),
    expiresAt: futureTimestamp(),
  });
}
