# @longsightgroup/lti-tool

## 0.1.1

### Patch Changes

- Add app-facing LTI facade interfaces, session-bound Advantage client interfaces, and the `@longsightgroup/lti-tool/testing` export.
- Add Hono custom launch callbacks for app-owned Resource Link and Deep Linking UI.
- Add typed dynamic-registration result classifications and canonical storage conflict error support.
- Add `createDeepLinkingHtmlResponse` for ready-to-return Deep Linking HTML responses.
- Clarify verify-time nonce claiming semantics and remove unused core nonce TTL configuration.
- Replace the `pino` peer dependency with a library-owned `LtiLogger` contract and `createNoopLogger()`. Hono route factories accept an optional `logger` and default to a noop logger at the route boundary.
