import { describe, expect, it, vi } from 'vitest';

import { testSession } from '#test-harness/fixtures';

import { requireLtiSession, type LtiSessionStorageReader } from '../src/index.js';

describe('requireLtiSession', () => {
  it('returns a session when storage finds one', async () => {
    const session = testSession({ id: 'session-1' });
    const storage: LtiSessionStorageReader = {
      getSession: vi.fn().mockResolvedValue(session),
    };

    const result = await requireLtiSession({ storage, sessionId: 'session-1' });

    expect(result).toEqual({ success: true, data: session });
    expect(storage.getSession).toHaveBeenCalledWith('session-1');
  });

  it('returns invalid_session_id when the session ID is empty', async () => {
    const storage: LtiSessionStorageReader = {
      getSession: vi.fn(),
    };

    const result = await requireLtiSession({ storage, sessionId: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({
        code: 'invalid_session_id',
        serviceKind: 'session',
        operation: 'requireLtiSession',
        message: 'LTI session ID is required',
      });
    }
    expect(storage.getSession).not.toHaveBeenCalled();
  });

  it('returns session_not_found when storage has no matching session', async () => {
    const storage: LtiSessionStorageReader = {
      getSession: vi.fn().mockResolvedValue(undefined),
    };

    const result = await requireLtiSession({ storage, sessionId: 'missing-session' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({
        code: 'session_not_found',
        serviceKind: 'session',
        operation: 'requireLtiSession',
        message: 'LTI session was not found',
      });
    }
  });

  it('returns session_storage_failed when storage rejects', async () => {
    const cause = new Error('database offline');
    const storage: LtiSessionStorageReader = {
      getSession: vi.fn().mockRejectedValue(cause),
    };

    const result = await requireLtiSession({ storage, sessionId: 'session-1' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({
        code: 'session_storage_failed',
        serviceKind: 'session',
        operation: 'requireLtiSession',
        message: 'LTI session could not be loaded',
        cause,
      });
    }
  });
});
