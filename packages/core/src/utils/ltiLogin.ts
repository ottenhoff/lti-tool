export interface BuildLtiLoginAuthUrlInput {
  launchConfig: { authUrl: string };
  validatedParams: {
    client_id: string;
    launchUrl: URL | string;
    login_hint: string;
    lti_deployment_id: string;
    lti_message_hint?: string;
  };
  state: string;
  nonce: string;
}

export function buildLtiLoginAuthUrl({
  launchConfig,
  validatedParams,
  state,
  nonce,
}: BuildLtiLoginAuthUrlInput): string {
  const authUrl = new URL(launchConfig.authUrl);
  authUrl.searchParams.set('scope', 'openid');
  authUrl.searchParams.set('response_type', 'id_token');
  authUrl.searchParams.set('response_mode', 'form_post');
  authUrl.searchParams.set('prompt', 'none');
  authUrl.searchParams.set('client_id', validatedParams.client_id);
  authUrl.searchParams.set('redirect_uri', validatedParams.launchUrl.toString());
  authUrl.searchParams.set('login_hint', validatedParams.login_hint);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('lti_deployment_id', validatedParams.lti_deployment_id);

  if (validatedParams.lti_message_hint) {
    authUrl.searchParams.set('lti_message_hint', validatedParams.lti_message_hint);
  }

  return authUrl.toString();
}
