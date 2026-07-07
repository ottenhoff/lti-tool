import {
  ltiServicePreconditionFailure,
  runLtiServiceOperation,
  type LtiServiceResult,
} from './errors/ltiServiceError.js';
import type { LTIConfig } from './interfaces/ltiConfig.js';
import type { DynamicRegistrationForm, RegistrationRequest } from './schemas/index.js';
import type { OpenIDConfiguration } from './schemas/lti13/dynamicRegistration/openIDConfiguration.schema.js';
import {
  DynamicRegistrationService,
  type LtiDynamicRegistrationCompletionResult,
  type LtiDynamicRegistrationInitiationOptions,
} from './services/dynamicRegistration.service.js';
import { createNoopLogger } from './utils/noopLogger.js';

/**
 * Optional LTI dynamic registration workflow facade.
 */
export class LtiDynamicRegistration {
  private readonly service?: DynamicRegistrationService;

  /**
   * Creates dynamic registration services from the tool configuration.
   *
   * @param config - Tool configuration with optional dynamicRegistration settings.
   */
  constructor(config: LTIConfig) {
    if (config.dynamicRegistration) {
      this.service = new DynamicRegistrationService(
        config.storage,
        config.dynamicRegistration,
        config.logger ?? createNoopLogger(),
      );
    }
  }

  /**
   * Fetches and validates platform OpenID configuration.
   */
  async fetchPlatformConfiguration(
    registrationRequest: RegistrationRequest,
  ): Promise<LtiServiceResult<OpenIDConfiguration>> {
    return await this.withService('fetchPlatformConfiguration', (service) =>
      service.fetchPlatformConfiguration(registrationRequest),
    );
  }

  /**
   * Starts dynamic registration and returns the administrator service selection form.
   */
  async initiateDynamicRegistration(
    registrationRequest: RegistrationRequest,
    requestPath: string,
    options?: LtiDynamicRegistrationInitiationOptions,
  ): Promise<LtiServiceResult<string>> {
    return await this.withService('initiateDynamicRegistration', (service) =>
      service.initiateDynamicRegistration(registrationRequest, requestPath, options),
    );
  }

  /**
   * Completes dynamic registration and stores the launch registration.
   */
  async completeDynamicRegistration(
    dynamicRegistrationForm: DynamicRegistrationForm,
  ): Promise<LtiServiceResult<LtiDynamicRegistrationCompletionResult>> {
    return await this.withService('completeDynamicRegistration', (service) =>
      service.completeDynamicRegistration(dynamicRegistrationForm),
    );
  }

  private withService<T>(
    operation: string,
    execute: (service: DynamicRegistrationService) => Promise<T>,
  ): Promise<LtiServiceResult<T>> {
    const service = this.service;
    if (!service) {
      return Promise.resolve(
        ltiServicePreconditionFailure({
          code: 'service_not_available',
          serviceKind: 'dynamic_registration',
          operation,
          message: 'Dynamic registration service is not configured',
        }),
      );
    }

    return runLtiServiceOperation({
      serviceKind: 'dynamic_registration',
      operation,
      execute: () => execute(service),
    });
  }
}
