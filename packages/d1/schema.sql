CREATE TABLE IF NOT EXISTS lti_tool_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  iss TEXT NOT NULL,
  client_id TEXT NOT NULL,
  auth_url TEXT NOT NULL,
  token_url TEXT NOT NULL,
  jwks_url TEXT NOT NULL,
  UNIQUE (iss, client_id)
);

CREATE INDEX IF NOT EXISTS lti_tool_clients_issuer_client_idx
  ON lti_tool_clients (client_id, iss);

CREATE TABLE IF NOT EXISTS lti_tool_deployments (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  deployment_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  FOREIGN KEY (client_id) REFERENCES lti_tool_clients(id) ON DELETE CASCADE,
  UNIQUE (client_id, deployment_id)
);

CREATE INDEX IF NOT EXISTS lti_tool_deployments_deployment_id_idx
  ON lti_tool_deployments (deployment_id);

CREATE TABLE IF NOT EXISTS lti_tool_sessions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS lti_tool_sessions_expires_at_idx
  ON lti_tool_sessions (expires_at);

CREATE TABLE IF NOT EXISTS lti_tool_nonces (
  nonce TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS lti_tool_nonces_expires_at_idx
  ON lti_tool_nonces (expires_at);

CREATE TABLE IF NOT EXISTS lti_tool_registration_sessions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS lti_tool_registration_sessions_expires_at_idx
  ON lti_tool_registration_sessions (expires_at);
