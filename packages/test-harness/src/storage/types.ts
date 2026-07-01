import type {
  LTIDynamicRegistrationSession,
  LTISession,
  LTIStorage,
} from '@longsightgroup/lti-tool';

export interface StorageHarness<TStorage extends LTIStorage = LTIStorage> {
  readonly storage: TStorage;
  reset(): Promise<void>;
  dispose(): Promise<void>;
  seedExpiredSession?(sessionId: string, session: LTISession): Promise<void>;
  seedExpiredNonce?(nonce: string): Promise<void>;
  seedExpiredRegistrationSession?(
    sessionId: string,
    session: LTIDynamicRegistrationSession,
  ): Promise<void>;
  seedActiveSession?(sessionId: string, payload?: Record<string, unknown>): Promise<void>;
  seedActiveNonce?(nonce: string): Promise<void>;
  seedActiveRegistrationSession?(
    sessionId: string,
    payload?: Record<string, unknown>,
  ): Promise<void>;
}
