# @lti-tool/d1

Cloudflare D1 storage adapter for `@lti-tool/core`.

## Installation

```bash
npm install @lti-tool/d1
```

## Usage

Apply `schema.sql` to your D1 database, then pass the binding to `D1Storage`.

```typescript
import { LTITool } from '@lti-tool/core';
import { D1Storage } from '@lti-tool/d1';

const storage = new D1Storage({
  database: env.DB,
});

const ltiTool = new LTITool({
  storage,
  // ... other config
});
```

## Schema

This adapter creates prefixed tables:

- `lti_tool_clients`
- `lti_tool_deployments`
- `lti_tool_sessions`
- `lti_tool_nonces`
- `lti_tool_registration_sessions`

The prefix keeps LTI storage separate from application tables in a shared D1
database.
