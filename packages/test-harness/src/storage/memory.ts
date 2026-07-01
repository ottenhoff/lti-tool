import { MemoryStorage } from '#storage/memory';

import type { StorageHarness } from './types.js';

export class MemoryStorageHarness implements StorageHarness<MemoryStorage> {
  readonly storage = new MemoryStorage();

  async reset(): Promise<void> {}

  async dispose(): Promise<void> {}
}

export function createMemoryHarness(): MemoryStorageHarness {
  return new MemoryStorageHarness();
}
