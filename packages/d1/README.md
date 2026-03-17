# @lti-tool/d1

<p align="center">Cloudflare D1 storage adapter for LTI 1.3, built for Workers and edge deployments.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@lti-tool/d1"><img alt="npm" src="https://img.shields.io/npm/v/%40lti-tool%2Fd1" /></a>
</p>

## Installation

```bash
npm install @lti-tool/d1
```

## Quick Start

```typescript
import { LTITool } from '@lti-tool/core';
import { D1Storage } from '@lti-tool/d1';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const storage = new D1Storage({
      database: env.DB,
    });

    const ltiTool = new LTITool({
      storage,
      security: {
        sessionExpirationSeconds: 60 * 60 * 24,
      },
      // ... other config
    });

    return new Response(`Configured ${Boolean(ltiTool)}`);
  },
};
```

## Features

- **Cloudflare Native** - Built around the D1 Worker binding shape
- **No ORM Required** - Uses straightforward SQL and a narrow D1 interface
- **Built-in Caching** - LRU caches for launch configs and sessions
- **Derived Launch Configs** - No duplicate launch-config table to maintain
- **Automatic Schema Bootstrap** - Creates required tables and indexes on first use

## API Reference

- [API Reference](https://docs.lti-tool.dev/modules/_lti-tool_d1.html) - Complete API documentation

## Configuration

### D1StorageConfig

- **database** (required): Cloudflare D1 binding, usually `env.DB`
- **nonceExpirationSeconds** (optional): Nonce TTL in seconds (default: 600)
- **logger** (optional): Pino-compatible logger for debugging

Session lifetime is configured in `LTITool` via `security.sessionExpirationSeconds`.

## Schema

The adapter bootstraps these tables automatically:

- **clients**: LTI platform clients
  Unique constraint: `(iss, clientId)`
- **deployments**: Platform deployments
  Unique constraint: `(clientId, deploymentId)`
- **sessions**: Serialized LTI sessions with millisecond `expiresAt`
- **nonces**: One-time-use nonces with millisecond `expiresAt`
- **registrationSessions**: Dynamic registration sessions with millisecond `expiresAt`

## Why `d1` Instead Of `sqlite`?

This package intentionally targets Cloudflare's D1 binding rather than generic SQLite drivers. A generic `sqlite` name would imply support for Node, Bun, libSQL, and embedded SQLite runtimes that expose different APIs and lifecycle expectations.
