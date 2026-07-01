import { createMemoryHarness } from '#test-harness/storage/memory';
import { defineStorageConformanceSuite } from '#test-harness/storageConformance';

defineStorageConformanceSuite('MemoryStorage', {
  createStorage: () => createMemoryHarness(),
});
