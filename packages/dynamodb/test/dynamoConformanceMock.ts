import {
  type AttributeValue,
  ConditionalCheckFailedException,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

type DynamoCommandInput = {
  readonly TableName?: string;
  readonly Item?: Record<string, AttributeValue>;
  readonly Key?: Record<string, AttributeValue>;
  readonly ExpressionAttributeValues?: Record<string, AttributeValue>;
  readonly KeyConditionExpression?: string;
  readonly IndexName?: string;
};

type DynamoMockState = {
  readonly clients: Map<string, Record<string, unknown>>;
  readonly deployments: Map<string, Map<string, Record<string, unknown>>>;
  readonly sessions: Map<string, Record<string, unknown>>;
  readonly nonces: Set<string>;
  readonly registrationSessions: Map<string, Record<string, unknown>>;
  readonly launchConfigs: Map<string, Map<string, Record<string, unknown>>>;
};

type DynamoMockResponse = ReturnType<typeof dynamoOk> & {
  readonly Item?: Record<string, AttributeValue>;
  readonly Items?: ReadonlyArray<Record<string, AttributeValue>>;
};

export function createDynamoConformanceMock(): (command: unknown) => unknown {
  const state = createDynamoMockState();

  return (command: unknown) => {
    const input = commandInput(command);
    const commandName = commandConstructorName(command);

    if (input.Item !== undefined) return handlePut(input, state);
    if (input.KeyConditionExpression !== undefined) return handleQuery(input, state);
    if (input.Key !== undefined && commandName === 'GetItemCommand') {
      return handleGet(input, state);
    }
    if (input.Key !== undefined && commandName === 'DeleteItemCommand') {
      return handleDelete(input, state);
    }

    return dynamoOk();
  };
}

function createDynamoMockState(): DynamoMockState {
  return {
    clients: new Map(),
    deployments: new Map(),
    sessions: new Map(),
    nonces: new Set(),
    registrationSessions: new Map(),
    launchConfigs: new Map(),
  };
}

function handlePut(
  input: DynamoCommandInput,
  state: DynamoMockState,
): DynamoMockResponse {
  const item = unmarshall(input.Item ?? {});

  if (input.TableName === 'controlPlane') return putControlPlaneItem(item, state);
  if (input.TableName === 'dataPlane') return putDataPlaneItem(item, state);
  if (input.TableName === 'launchConfigs') {
    const launchConfigItems = state.launchConfigs.get(String(item.pk)) ?? new Map();
    launchConfigItems.set(String(item.sk), item);
    state.launchConfigs.set(String(item.pk), launchConfigItems);
  }

  return dynamoOk();
}

function putControlPlaneItem(
  item: Record<string, unknown>,
  state: DynamoMockState,
): DynamoMockResponse {
  if (item.type === 'Client') {
    state.clients.set(String(item.id), item);
    return dynamoOk();
  }

  if (item.type === 'Deployment') {
    const clientDeployments = state.deployments.get(String(item.pk)) ?? new Map();
    clientDeployments.set(String(item.id), item);
    state.deployments.set(String(item.pk), clientDeployments);
  }

  return dynamoOk();
}

function putDataPlaneItem(
  item: Record<string, unknown>,
  state: DynamoMockState,
): DynamoMockResponse {
  const pk = String(item.pk ?? '');
  if (pk.startsWith('DYNREG#')) {
    state.registrationSessions.set(pk, item);
    return dynamoOk();
  }
  if (pk.startsWith('S#')) {
    state.sessions.set(pk, item);
    return dynamoOk();
  }

  if (state.nonces.has(pk)) {
    throw new ConditionalCheckFailedException({
      message: 'The conditional request failed',
      $metadata: {},
    });
  }
  state.nonces.add(pk);
  return dynamoOk();
}

function handleQuery(
  input: DynamoCommandInput,
  state: DynamoMockState,
): DynamoMockResponse {
  if (input.TableName === 'controlPlane') return queryControlPlane(input, state);
  if (input.TableName === 'launchConfigs') {
    const pk = expressionString(input, ':pk');
    return {
      ...dynamoOk(),
      Items: [...(state.launchConfigs.get(pk)?.values() ?? [])].map((item) =>
        marshallRecord(item),
      ),
    };
  }
  return dynamoOk();
}

function queryControlPlane(
  input: DynamoCommandInput,
  state: DynamoMockState,
): DynamoMockResponse {
  if (input.IndexName === 'GSI1') {
    return { ...dynamoOk(), Items: [...state.clients.values()].map(marshallRecord) };
  }
  if (input.IndexName === 'GSI2') {
    const pk = expressionString(input, ':gsi2pk');
    const gsi2sk = expressionString(input, ':gsi2sk');
    const deployment = [...(state.deployments.get(pk)?.values() ?? [])].find(
      (item) => item.gsi2sk === gsi2sk,
    );
    return {
      ...dynamoOk(),
      Items: deployment === undefined ? [] : [marshallRecord(deployment)],
    };
  }

  return queryClientItems(input, state);
}

function queryClientItems(
  input: DynamoCommandInput,
  state: DynamoMockState,
): DynamoMockResponse {
  const pk = expressionString(input, ':pk');
  const client = state.clients.get(pk.replace(/^C#/, ''));
  const deployments = [...(state.deployments.get(pk)?.values() ?? [])];
  if (input.KeyConditionExpression?.includes('begins_with')) {
    return { ...dynamoOk(), Items: deployments.map(marshallRecord) };
  }

  const items = client === undefined ? [] : [client, ...deployments];
  return { ...dynamoOk(), Items: items.map(marshallRecord) };
}

function handleGet(
  input: DynamoCommandInput,
  state: DynamoMockState,
): DynamoMockResponse {
  const key = unmarshall(input.Key ?? {});
  if (input.TableName === 'controlPlane') return getControlPlaneItem(key, state);
  if (input.TableName === 'dataPlane') return getDataPlaneItem(key, state);
  if (input.TableName === 'launchConfigs') {
    return itemResponse(state.launchConfigs.get(String(key.pk))?.get(String(key.sk)));
  }
  return dynamoOk();
}

function getControlPlaneItem(
  key: Record<string, unknown>,
  state: DynamoMockState,
): DynamoMockResponse {
  if (String(key.sk) === '#') {
    return itemResponse(state.clients.get(String(key.pk).replace(/^C#/, '')));
  }

  return itemResponse(
    state.deployments.get(String(key.pk))?.get(String(key.sk).replace(/^D#/, '')),
  );
}

function getDataPlaneItem(
  key: Record<string, unknown>,
  state: DynamoMockState,
): DynamoMockResponse {
  const pk = String(key.pk);
  const item = pk.startsWith('DYNREG#')
    ? state.registrationSessions.get(pk)
    : state.sessions.get(pk);
  return itemResponse(item);
}

function handleDelete(
  input: DynamoCommandInput,
  state: DynamoMockState,
): DynamoMockResponse {
  const key = unmarshall(input.Key ?? {});
  const pk = dynamoKeyString(key.pk);
  const sk = dynamoKeyString(key.sk);

  if (input.TableName === 'controlPlane') deleteControlPlaneItem(pk, sk, state);
  if (input.TableName === 'dataPlane') deleteDataPlaneItem(pk, state);
  if (input.TableName === 'launchConfigs') state.launchConfigs.get(pk)?.delete(sk);

  return dynamoOk();
}

function deleteControlPlaneItem(pk: string, sk: string, state: DynamoMockState): void {
  if (sk === '#') {
    state.clients.delete(pk.replace(/^C#/, ''));
    return;
  }

  state.deployments.get(pk)?.delete(sk.replace(/^D#/, ''));
}

function deleteDataPlaneItem(pk: string, state: DynamoMockState): void {
  state.sessions.delete(pk);
  state.registrationSessions.delete(pk);
  state.nonces.delete(pk);
}

function itemResponse(item: Record<string, unknown> | undefined): DynamoMockResponse {
  return item === undefined ? dynamoOk() : { ...dynamoOk(), Item: marshallRecord(item) };
}

function marshallRecord(record: Record<string, unknown>): Record<string, AttributeValue> {
  return marshall(record);
}

function expressionString(input: DynamoCommandInput, name: string): string {
  return attributeString(input.ExpressionAttributeValues?.[name]);
}

function commandInput(command: unknown): DynamoCommandInput {
  return (command as { readonly input: DynamoCommandInput }).input;
}

function commandConstructorName(command: unknown): string {
  return (command as { readonly constructor: { readonly name: string } }).constructor
    .name;
}

function attributeString(attribute: unknown): string {
  return String((attribute as { readonly S?: string }).S);
}

function dynamoKeyString(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'S' in value) {
    const candidate = value as { readonly S?: unknown };
    if (typeof candidate.S === 'string') return candidate.S;
  }

  return String(value);
}

function dynamoOk(): { readonly $metadata: { readonly httpStatusCode: number } } {
  return { $metadata: { httpStatusCode: 200 } };
}

export { commandInput, dynamoOk };
