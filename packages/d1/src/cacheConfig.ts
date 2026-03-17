import type { LTILaunchConfig, LTISession } from '@lti-tool/core';
import { LRUCache } from 'lru-cache';

export const LAUNCH_CONFIG_CACHE = new LRUCache<
  string,
  LTILaunchConfig | undefinedLaunchConfig
>({
  max: 1000,
  ttl: 1000 * 60 * 15,
});
export const SESSION_CACHE_TTL_MS = 1000 * 60 * 5;
export const SESSION_CACHE = new LRUCache<string, LTISession | undefinedSession>({
  max: 1000,
  ttl: SESSION_CACHE_TTL_MS,
});

export const undefinedLaunchConfigValue = Symbol('undefinedLaunchConfig');
export type undefinedLaunchConfig = typeof undefinedLaunchConfigValue;
export const undefinedSessionValue = Symbol('undefinedSession');
export type undefinedSession = typeof undefinedSessionValue;
