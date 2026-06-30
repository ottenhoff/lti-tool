import type { LTIClient } from '@longsightgroup/lti-tool';

import type { DynamoBase } from './dynamoBase.js';

export interface DynamoLTIClient extends LTIClient, DynamoBase {
  type: 'Client';
}
