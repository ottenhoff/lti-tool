import {
  LTIDynamicRegistrationSessionSchema,
  LTISessionSchema,
  type LTIClient,
  type LTIDynamicRegistrationSession,
  type LTILaunchConfig,
  type LTISession,
} from '@longsightgroup/lti-tool';

export type ClientRow = Omit<LTIClient, 'deployments'>;

export type SessionDataRow = {
  readonly id: string;
  readonly data: Omit<LTISession, 'id'>;
};

export type RegistrationSessionDataRow = {
  readonly data: LTIDynamicRegistrationSession;
};

export type LaunchConfigRow = LTILaunchConfig;

export function projectClient(client: ClientRow): Omit<LTIClient, 'deployments'> {
  return {
    id: client.id,
    name: client.name,
    iss: client.iss,
    clientId: client.clientId,
    authUrl: client.authUrl,
    tokenUrl: client.tokenUrl,
    jwksUrl: client.jwksUrl,
  };
}

export function toSessionDataRow(session: LTISession): SessionDataRow {
  const { id, ...data } = session;
  return { id, data };
}

export function parseSessionDataRow(row: SessionDataRow): LTISession | undefined {
  const parsed = LTISessionSchema.safeParse({ id: row.id, ...row.data });
  return parsed.success ? parsed.data : undefined;
}

export function parseRegistrationSessionDataRow(
  row: RegistrationSessionDataRow,
): LTIDynamicRegistrationSession | undefined {
  const parsed = LTIDynamicRegistrationSessionSchema.safeParse(row.data);
  return parsed.success ? parsed.data : undefined;
}
