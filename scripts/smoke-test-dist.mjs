const packages = [
  '@longsightgroup/lti-tool',
  '@longsightgroup/lti-tool/hono',
  '@longsightgroup/lti-tool/storage/memory',
  '@longsightgroup/lti-tool/storage/mysql',
  '@longsightgroup/lti-tool/storage/postgresql',
  '@longsightgroup/lti-tool/storage/dynamodb',
  '@longsightgroup/lti-tool/storage/d1',
  '@longsightgroup/lti-tool/testing',
];

for (const packageName of packages) {
  await import(packageName);
  console.log(`✓ ${packageName}`);
}
