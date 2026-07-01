import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

type PackageImportTarget =
  | string
  | {
      readonly source?: string;
    };

type PackageJson = {
  readonly exports?: Record<string, PackageImportTarget>;
  readonly imports?: Record<string, PackageImportTarget>;
};

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as PackageJson;

function sourceAliases(): Record<string, string> {
  return {
    ...packageExportAliases(),
    '#test-harness/': fileURLToPath(
      new URL('./packages/test-harness/src/', import.meta.url),
    ),
    ...Object.fromEntries(
      Object.entries(packageJson.imports ?? {}).flatMap(([specifier, target]) => {
        if (typeof target === 'string' || target.source === undefined) return [];

        return [[specifier, fileURLToPath(new URL(target.source, import.meta.url))]];
      }),
    ),
  };
}

function packageExportAliases(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(packageJson.exports ?? {}).flatMap(([specifier, target]) => {
      if (specifier === './package.json') return [];
      if (typeof target === 'string' || target.source === undefined) return [];

      const alias =
        specifier === '.'
          ? '@longsightgroup/lti-tool'
          : `@longsightgroup/lti-tool/${specifier.replace(/^\.\//, '')}`;

      return [[alias, fileURLToPath(new URL(target.source, import.meta.url))]];
    }),
  );
}

export default defineConfig({
  resolve: {
    alias: sourceAliases(),
  },
});
