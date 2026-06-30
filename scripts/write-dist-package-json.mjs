import { readFile, writeFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

const distPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  type: packageJson.type,
  exports: distExports(packageJson.exports),
  imports: distExports(packageJson.imports),
};

await writeFile('dist/package.json', `${JSON.stringify(distPackageJson, null, 2)}\n`);

function distExports(exportsMap) {
  return Object.fromEntries(
    Object.entries(exportsMap).map(([specifier, target]) => [
      specifier,
      distExportTarget(target),
    ]),
  );
}

function distExportTarget(target) {
  if (typeof target === 'string') return distPath(target);

  return Object.fromEntries(
    Object.entries(target)
      .filter(([condition]) => condition !== 'source')
      .map(([condition, conditionTarget]) => [condition, distPath(conditionTarget)]),
  );
}

function distPath(path) {
  return path.replace(/^\.(?:\/dist)?\//, './');
}
