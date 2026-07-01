import type { Logger } from 'pino';

import {
  LTI_AGS_SCOPE_LINEITEM,
  LTI_AGS_SCOPE_LINEITEM_READONLY,
  LTI_AGS_SCOPE_RESULT_READONLY,
  LTI_AGS_SCOPE_SCORE,
} from './constants.js';
import {
  ltiServicePreconditionFailure,
  runLtiServiceCall,
  runLtiServiceOperation,
  type LtiServiceResult,
} from './errors/ltiServiceError.js';
import type { LTISession } from './interfaces/ltiSession.js';
import type { LTIStorage } from './interfaces/ltiStorage.js';
import {
  type CreateLineItem,
  type LineItem,
  LineItemSchema,
  type LineItems,
  LineItemsSchema,
  type UpdateLineItem,
} from './schemas/lti13/ags/lineItem.schema.js';
import { type Results, ResultsSchema } from './schemas/lti13/ags/result.schema.js';
import type { ScoreSubmission } from './schemas/lti13/ags/scoreSubmission.schema.js';
import type { DeepLinkingContentItem } from './schemas/lti13/deepLinking/contentItem.schema.js';
import type { Member } from './schemas/lti13/nrps/contextMembership.schema.js';
import {
  AGSService,
  type AGSGetScoresOptions,
  type AGSLineItemTargetOptions,
  type AGSListLineItemsOptions,
} from './services/ags.service.js';
import { DeepLinkingService } from './services/deepLinking.service.js';
import { NRPSService } from './services/nrps.service.js';
import type { TokenService } from './services/token.service.js';
import { hasLtiAgsScope, isLtiAgsLineItemsAvailable } from './utils/ags.js';
import { normalizeLtiNrpsMembersResponse } from './utils/nrps.js';

type LtiAdvantageServices = {
  readonly agsService: AGSService;
  readonly nrpsService: NRPSService;
  readonly deepLinkingService: DeepLinkingService;
};

export type LtiAdvantageInput = {
  readonly session: LTISession;
  readonly tokenService: TokenService;
  readonly storage: LTIStorage;
  readonly keyPair: CryptoKeyPair;
  readonly keyId: string;
  readonly logger: Logger;
};

const requireAgsLineItem = <T>(
  session: LTISession,
  operation: string,
  lineItemUrl = session.services?.ags?.lineitem,
): string | LtiServiceResult<T> => {
  const resolved = lineItemUrl ?? session.services?.ags?.lineitem;
  if (resolved !== undefined) return resolved;

  return ltiServicePreconditionFailure({
    code: 'service_not_available',
    serviceKind: 'ags',
    operation,
    message: 'AGS line item service is not available for this session',
  });
};

const requireAgsLineItems = <T>(
  session: LTISession,
  operation: string,
): string | LtiServiceResult<T> => {
  const ags = session.services?.ags;
  if (isLtiAgsLineItemsAvailable(session) && ags?.lineitems !== undefined) {
    return ags.lineitems;
  }

  return ltiServicePreconditionFailure({
    code: 'service_not_available',
    serviceKind: 'ags',
    operation,
    message: 'AGS line items service is not available for this session',
  });
};

const requireAgsScope = <T>(
  session: LTISession,
  scope: string,
  operation: string,
): LtiServiceResult<T> | undefined => {
  if (hasLtiAgsScope(session, scope)) return undefined;

  return ltiServicePreconditionFailure({
    code: 'missing_required_scope',
    serviceKind: 'ags',
    operation,
    message: `Missing required AGS scope '${scope}'`,
  });
};

const requireNrpsMembership = <T>(
  session: LTISession,
  operation: string,
): string | LtiServiceResult<T> => {
  if (session.services?.nrps?.membershipUrl) return session.services.nrps.membershipUrl;

  return ltiServicePreconditionFailure({
    code: 'service_not_available',
    serviceKind: 'nrps',
    operation,
    message: 'NRPS membership service is not available for this session',
  });
};

type AgsUrlResolver<T> = () => string | LtiServiceResult<T>;

const runAgsJsonOperation = <T>(
  session: LTISession,
  input: {
    operation: string;
    scope: string;
    resolveUrl: AgsUrlResolver<T>;
    parse: (data: unknown) => T;
    request: (url: string) => Promise<Response>;
  },
): Promise<LtiServiceResult<T>> => {
  const url = input.resolveUrl();
  if (typeof url !== 'string') return Promise.resolve(url);

  const scopeError = requireAgsScope<T>(session, input.scope, input.operation);
  if (scopeError) return Promise.resolve(scopeError);

  return runLtiServiceCall({
    serviceKind: 'ags',
    operation: input.operation,
    request: () => input.request(url),
    responseBody: 'json',
    parse: input.parse,
  });
};

const runAgsEmptyOperation = (
  session: LTISession,
  input: {
    operation: string;
    scope: string;
    resolveUrl: AgsUrlResolver<void>;
    request: (url: string) => Promise<Response>;
  },
): Promise<LtiServiceResult<void>> => {
  const url = input.resolveUrl();
  if (typeof url !== 'string') return Promise.resolve(url);

  const scopeError = requireAgsScope<void>(session, input.scope, input.operation);
  if (scopeError) return Promise.resolve(scopeError);

  return runLtiServiceCall({
    serviceKind: 'ags',
    operation: input.operation,
    request: () => input.request(url),
    responseBody: 'none',
  });
};

/**
 * Session-bound LTI Advantage facade for AGS, NRPS, and Deep Linking.
 */
export interface LtiAgsClient {
  submitScore: LtiAdvantage['submitScore'];
  getScores: LtiAdvantage['getScores'];
  listLineItems: LtiAdvantage['listLineItems'];
  getLineItem: LtiAdvantage['getLineItem'];
  createLineItem: LtiAdvantage['createLineItem'];
  updateLineItem: LtiAdvantage['updateLineItem'];
  deleteLineItem: LtiAdvantage['deleteLineItem'];
}

/**
 * Session-bound Names and Role Provisioning Services client.
 */
export interface LtiNrpsClient {
  getMembers: LtiAdvantage['getMembers'];
}

/**
 * Session-bound Deep Linking client.
 */
export interface LtiDeepLinkingClient {
  createDeepLinkingResponse: LtiAdvantage['createDeepLinkingResponse'];
  createDeepLinkingHtmlResponse: LtiAdvantage['createDeepLinkingHtmlResponse'];
}

/**
 * Complete session-bound LTI Advantage facade.
 */
export interface LtiAdvantagePort
  extends LtiAgsClient, LtiNrpsClient, LtiDeepLinkingClient {}

export class LtiAdvantage {
  private readonly session: LTISession;
  private readonly services: LtiAdvantageServices;

  /**
   * Creates a session-bound Advantage facade.
   *
   * @param input - Session and service dependencies supplied by LTITool.
   */
  constructor(input: LtiAdvantageInput) {
    this.session = input.session;
    this.services = {
      agsService: new AGSService(input.tokenService, input.storage, input.logger),
      nrpsService: new NRPSService(input.tokenService, input.storage, input.logger),
      deepLinkingService: new DeepLinkingService(
        input.keyPair,
        input.logger,
        input.keyId,
      ),
    };
  }

  /**
   * Submits a grade score to the platform using Assignment and Grade Services.
   */
  async submitScore(score: ScoreSubmission): Promise<LtiServiceResult<void>> {
    return await runAgsEmptyOperation(this.session, {
      operation: 'submitScore',
      scope: LTI_AGS_SCOPE_SCORE,
      resolveUrl: () => requireAgsLineItem<void>(this.session, 'submitScore'),
      request: (url) => this.services.agsService.submitScore(this.session, url, score),
    });
  }

  /**
   * Retrieves all scores for a line item from the platform.
   */
  async getScores(options: AGSGetScoresOptions = {}): Promise<LtiServiceResult<Results>> {
    return await runAgsJsonOperation(this.session, {
      operation: 'getScores',
      scope: LTI_AGS_SCOPE_RESULT_READONLY,
      resolveUrl: () =>
        requireAgsLineItem<Results>(this.session, 'getScores', options.lineItemUrl),
      parse: (data) => ResultsSchema.parse(data),
      request: (url) => this.services.agsService.getScores(this.session, url, options),
    });
  }

  /**
   * Lists platform gradebook line items.
   */
  async listLineItems(
    options: AGSListLineItemsOptions = {},
  ): Promise<LtiServiceResult<LineItems>> {
    return await runAgsJsonOperation(this.session, {
      operation: 'listLineItems',
      scope: LTI_AGS_SCOPE_LINEITEM_READONLY,
      resolveUrl: () => requireAgsLineItems<LineItems>(this.session, 'listLineItems'),
      parse: (data) => LineItemsSchema.parse(data),
      request: (url) =>
        this.services.agsService.listLineItems(this.session, url, options),
    });
  }

  /**
   * Retrieves a single platform gradebook line item.
   */
  async getLineItem(
    options: AGSLineItemTargetOptions = {},
  ): Promise<LtiServiceResult<LineItem>> {
    return await runAgsJsonOperation(this.session, {
      operation: 'getLineItem',
      scope: LTI_AGS_SCOPE_LINEITEM_READONLY,
      resolveUrl: () =>
        requireAgsLineItem<LineItem>(this.session, 'getLineItem', options.lineItemUrl),
      parse: (data) => LineItemSchema.parse(data),
      request: (url) => this.services.agsService.getLineItem(this.session, url),
    });
  }

  /**
   * Creates a platform gradebook line item.
   */
  async createLineItem(
    createLineItem: CreateLineItem,
  ): Promise<LtiServiceResult<LineItem>> {
    return await runAgsJsonOperation(this.session, {
      operation: 'createLineItem',
      scope: LTI_AGS_SCOPE_LINEITEM,
      resolveUrl: () => requireAgsLineItems<LineItem>(this.session, 'createLineItem'),
      parse: (data) => LineItemSchema.parse(data),
      request: (url) =>
        this.services.agsService.createLineItem(this.session, url, createLineItem),
    });
  }

  /**
   * Updates the session's target platform gradebook line item.
   */
  async updateLineItem(
    updateLineItem: UpdateLineItem,
  ): Promise<LtiServiceResult<LineItem>> {
    return await runAgsJsonOperation(this.session, {
      operation: 'updateLineItem',
      scope: LTI_AGS_SCOPE_LINEITEM,
      resolveUrl: () => requireAgsLineItem<LineItem>(this.session, 'updateLineItem'),
      parse: (data) => LineItemSchema.parse(data),
      request: (url) =>
        this.services.agsService.updateLineItem(this.session, url, updateLineItem),
    });
  }

  /**
   * Deletes the session's target platform gradebook line item.
   */
  async deleteLineItem(): Promise<LtiServiceResult<void>> {
    return await runAgsEmptyOperation(this.session, {
      operation: 'deleteLineItem',
      scope: LTI_AGS_SCOPE_LINEITEM,
      resolveUrl: () => requireAgsLineItem<void>(this.session, 'deleteLineItem'),
      request: (url) => this.services.agsService.deleteLineItem(this.session, url),
    });
  }

  /**
   * Retrieves course/context members using Names and Role Provisioning Services.
   */
  async getMembers(): Promise<LtiServiceResult<Member[]>> {
    const membershipUrl = requireNrpsMembership<Member[]>(this.session, 'getMembers');
    if (typeof membershipUrl !== 'string') return membershipUrl;

    return await runLtiServiceCall({
      serviceKind: 'nrps',
      operation: 'getMembers',
      request: () => this.services.nrpsService.getMembers(this.session, membershipUrl),
      responseBody: 'json',
      parse: (data) => normalizeLtiNrpsMembersResponse(data),
    });
  }

  /**
   * Creates a Deep Linking response with selected content items.
   */
  async createDeepLinkingResponse(
    contentItems: DeepLinkingContentItem[],
  ): Promise<LtiServiceResult<string>> {
    if (!contentItems) {
      throw new Error('contentItems is required');
    }

    if (!this.session.services?.deepLinking) {
      return ltiServicePreconditionFailure({
        code: 'service_not_available',
        serviceKind: 'deep_linking',
        operation: 'createDeepLinkingResponse',
        message: 'Deep Linking is not available for this session',
      });
    }

    return await runLtiServiceOperation({
      serviceKind: 'deep_linking',
      operation: 'createDeepLinkingResponse',
      execute: () =>
        this.services.deepLinkingService.createResponse(this.session, contentItems),
    });
  }

  /**
   * Creates an HTML Response that auto-submits selected Deep Linking content items.
   */
  async createDeepLinkingHtmlResponse(
    contentItems: DeepLinkingContentItem[],
  ): Promise<LtiServiceResult<Response>> {
    const result = await this.createDeepLinkingResponse(contentItems);
    if (!result.success) return result;

    return {
      success: true,
      data: new Response(result.data, {
        headers: {
          'cache-control': 'no-store',
          'content-type': 'text/html; charset=utf-8',
        },
      }),
    };
  }
}
