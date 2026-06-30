import type { LTILaunchConfig } from '@longsightgroup/lti-tool';
import { LRUCache } from 'lru-cache';

export const LAUNCH_CONFIG_CACHE = new LRUCache<
  string,
  LTILaunchConfig | undefinedLaunchConfig
>({
  max: 1000,
  ttl: 1000 * 60 * 15, // 15 minutes
});

export const SESSION_TTL = 60 * 60 * 24; // session ttl is one day

// we need an undefined value to handle cache misses and cache them
export const undefinedLaunchConfigValue = Symbol('undefinedLaunchConfig');
export type undefinedLaunchConfig = typeof undefinedLaunchConfigValue;
