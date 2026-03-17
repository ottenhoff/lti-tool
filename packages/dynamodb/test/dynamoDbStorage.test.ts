// oxlint-disable max-lines-per-function
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import type { LTIClient, LTISession } from '@lti-tool/core';
import type { BaseLogger } from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamoDbStorage } from '../src';
import {
  LAUNCH_CONFIG_CACHE,
  SESSION_CACHE,
  undefinedSessionValue,
} from '../src/cacheConfig';

vi.mock('@aws-sdk/client-dynamodb');

const mockSend = vi.fn();
vi.mocked(DynamoDBClient).mockImplementation(function () {
  return {
    send: mockSend,
  } as unknown as DynamoDBClient;
});

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  silent: vi.fn(),
  level: 'info',
  msgPrefix: '',
} as BaseLogger;
const mockClient: LTIClient = {
  id: 'client-uuid-123',
  iss: 'https://platform.example.com',
  clientId: 'client123',
  authUrl: 'https://platform.example.com/auth',
  tokenUrl: 'https://platform.example.com/token',
  jwksUrl: 'https://platform.example.com/.well-known/jwks',
  deployments: [
    {
      id: 'deployment',
      deploymentId: 'deployment1',
    },
  ],
  name: 'Test Client',
};

const mockLaunchConfig = {
  iss: 'https://platform.example.com',
  clientId: 'client123',
  deploymentId: 'deployment1',
  authUrl: 'https://platform.example.com/auth',
  tokenUrl: 'https://platform.example.com/token',
  jwksUrl: 'https://platform.example.com/.well-known/jwks',
};

const mockSession: LTISession = {
  id: 'session123',
  jwtPayload: {},
  user: { id: 'user123', roles: [] },
  context: { id: 'context123', label: 'TEST', title: 'Test' },
  platform: {
    issuer: 'https://platform.example.com',
    clientId: 'client123',
    deploymentId: 'deployment1',
    name: 'Test',
  },
  launch: { target: 'https://tool.example.com/v1p3/debug' },
  customParameters: {},
  isAdmin: false,
  isInstructor: false,
  isStudent: false,
  isAssignmentAndGradesAvailable: false,
  isDeepLinkingAvailable: false,
  isNameAndRolesAvailable: false,
};

describe('DynamoDbStorage', () => {
  let storage: DynamoDbStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    LAUNCH_CONFIG_CACHE.clear();
    SESSION_CACHE.clear();

    // Reset mock implementation to ensure clean state
    mockSend.mockReset();

    storage = new DynamoDbStorage({
      controlPlaneTable: 'controlPlane',
      dataPlaneTable: 'dataPlane',
      launchConfigTable: 'launchConfigs',
      // oxlint-disable no-explicit-anyq
      logger: mockLogger as any,
    });
  });

  describe('getClientById', () => {
    it('fetches from DynamoDB when not cached', async () => {
      mockSend.mockResolvedValue({
        $metadata: { httpStatusCode: 200 },
        Items: [
          // Client record
          marshall({
            pk: 'C#client-uuid-123',
            sk: '#',
            type: 'Client',
            ...mockClient,
          }),
          // Deployment record
          marshall({
            pk: 'C#client-uuid-123',
            sk: 'D#deployment',
            type: 'Deployment',
            id: 'deployment',
            deploymentId: 'deployment1',
          }),
        ],
      });

      const result = await storage.getClientById('client-uuid-123');

      expect(result).toEqual(expect.objectContaining(mockClient));
      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe('updateClient', () => {
    it('updates existing client', async () => {
      // Mock getClientById call (validates client exists)
      mockSend.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 200 },
        Items: [
          marshall({
            pk: 'C#client-uuid-123',
            sk: '#',
            type: 'Client',
            ...mockClient,
          }),
          marshall({
            pk: 'C#client-uuid-123',
            sk: 'D#deployment',
            type: 'Deployment',
            id: 'deployment',
            deploymentId: 'deployment1',
          }),
        ],
      });

      // Mock the PutItem update operation
      mockSend.mockResolvedValueOnce({ $metadata: { httpStatusCode: 200 } });

      // Spy on updateClientLaunchConfigs to avoid the complex mocking
      const updateLaunchConfigsSpy = vi
        .spyOn(storage as any, 'updateClientLaunchConfigs')
        .mockResolvedValue(undefined);

      await storage.updateClient('client-uuid-123', {
        name: 'Updated',
      });

      expect(mockSend).toHaveBeenCalledTimes(2); // getClientById + PutItem
      expect(updateLaunchConfigsSpy).toHaveBeenCalledWith('client-uuid-123');

      updateLaunchConfigsSpy.mockRestore();
    });
  });

  describe('validateNonce', () => {
    it('returns false for existing nonce (replay attack)', async () => {
      const conditionalError = new ConditionalCheckFailedException({
        message: 'The conditional request failed',
        $metadata: {},
      });

      mockSend.mockRejectedValue(conditionalError);

      const result = await storage.validateNonce('used-nonce');

      expect(result).toBe(false);
    });

    it('returns true and stores new nonce', async () => {
      mockSend
        .mockResolvedValueOnce({ $metadata: { httpStatusCode: 200 }, Item: undefined })
        .mockResolvedValueOnce({ $metadata: { httpStatusCode: 200 } });

      const result = await storage.validateNonce('new-nonce');

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1); // single conditional input
    });
  });

  describe('getSession', () => {
    it('returns cached session', async () => {
      SESSION_CACHE.set('session123', mockSession);

      const result = await storage.getSession('session123');

      expect(result).toEqual(mockSession);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('fetches from DynamoDB', async () => {
      mockSend.mockResolvedValue({
        $metadata: { httpStatusCode: 200 },
        Item: marshall({ ...mockSession, ttl: Math.floor(Date.now() / 1000) + 3600 }),
      });

      const result = await storage.getSession('session123');

      expect(result).toEqual(expect.objectContaining({ id: 'session123' }));
    });

    it('returns undefined for expired DynamoDB sessions even before TTL cleanup runs', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
      mockSend.mockResolvedValue({
        $metadata: { httpStatusCode: 200 },
        Item: marshall({ ...mockSession, ttl: 1_000 }),
      });

      const result = await storage.getSession('session123');

      expect(result).toBeUndefined();
      expect(SESSION_CACHE.get('session123')).toBe(undefinedSessionValue);
    });
  });

  describe('addSession', () => {
    it('stores session with TTL', async () => {
      mockSend.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
      vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

      await storage.addSession(mockSession, new Date(1_042_000));

      expect(mockSend).toHaveBeenCalledOnce();
      expect(SESSION_CACHE.get('session123')).toEqual(mockSession);
      expect(SESSION_CACHE.info('session123')?.ttl).toBeLessThanOrEqual(42_000);
    });
  });

  describe('getLaunchConfig', () => {
    it('returns cached launch config', async () => {
      // Pre-populate cache
      LAUNCH_CONFIG_CACHE.set(
        'https://platform.example.com#client123#deployment1',
        mockLaunchConfig,
      );

      const result = await storage.getLaunchConfig(
        'https://platform.example.com',
        'client123',
        'deployment1',
      );

      expect(result).toEqual(mockLaunchConfig);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('fetches from DynamoDB when not cached and caches result', async () => {
      mockSend.mockResolvedValue({
        $metadata: { httpStatusCode: 200 },
        Item: marshall(mockLaunchConfig),
      });

      const result = await storage.getLaunchConfig(
        'https://platform.example.com',
        'client123',
        'deployment1',
      );

      expect(result).toEqual(mockLaunchConfig);
      expect(mockSend).toHaveBeenCalledOnce();

      // Verify it was cached
      const cacheKey = 'https://platform.example.com#client123#deployment1';
      expect(LAUNCH_CONFIG_CACHE.get(cacheKey)).toEqual(mockLaunchConfig);
    });
  });
});
