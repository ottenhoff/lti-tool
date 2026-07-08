/** Deep Linking settings advertised by a platform in an LTI Deep Linking launch. */
export interface LtiDeepLinkingSettings {
  /** URL to return the Deep Linking response. */
  returnUrl: string;
  /** Accepted content item types. */
  acceptTypes: string[];
  /** Accepted presentation targets. */
  acceptPresentationDocumentTargets: string[];
  /** Accepted media types. */
  acceptMediaTypes?: string;
  /** Whether multiple items can be selected. */
  acceptMultiple: boolean;
  /** Whether the platform supports line items in returned LTI Resource Link items. */
  acceptLineItem?: boolean;
  /** Whether items should be auto-created. */
  autoCreate: boolean;
  /** Default title for returned content items. */
  title?: string;
  /** Default visible text for returned content items. */
  text?: string;
  /** Platform-specific data to return. */
  data?: string;
}
