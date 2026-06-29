import { escapeHtml } from './htmlEscaping.js';

export interface LtiPostMessageStorageRedirect {
  authorizationRedirectUrl: string;
  platformOrigin: string;
  storageTarget: string;
  state: string;
  nonce: string;
}

export function createLtiPostMessageStorageRedirect(input: {
  authorizationRedirectUrl: string | URL;
  storageTarget?: string;
}): LtiPostMessageStorageRedirect | null {
  if (input.storageTarget === undefined || input.storageTarget.trim().length === 0) {
    return null;
  }

  const redirectUrl = new URL(input.authorizationRedirectUrl);
  const state = redirectUrl.searchParams.get('state');
  const nonce = redirectUrl.searchParams.get('nonce');

  if (state === null || nonce === null) {
    return null;
  }

  return {
    authorizationRedirectUrl: redirectUrl.toString(),
    platformOrigin: redirectUrl.origin,
    storageTarget: input.storageTarget,
    state,
    nonce,
  };
}

export function renderLtiPostMessageStorageRedirectPage(
  input: LtiPostMessageStorageRedirect,
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>LTI Launch Redirect</title>
  </head>
  <body>
    <section
      id="lti-post-message-storage-redirect"
      data-authorization-redirect-url="${escapeHtml(input.authorizationRedirectUrl)}"
      data-platform-origin="${escapeHtml(input.platformOrigin)}"
      data-storage-target="${escapeHtml(input.storageTarget)}"
      data-state="${escapeHtml(input.state)}"
      data-nonce="${escapeHtml(input.nonce)}"
    >
      <p role="status" aria-live="polite">Continuing LTI launch.</p>
    </section>
    <script>${LTI_POST_MESSAGE_STORAGE_SCRIPT}</script>
  </body>
</html>`;
}

const LTI_POST_MESSAGE_STORAGE_SCRIPT = `(() => {
  const root = document.getElementById("lti-post-message-storage-redirect");
  if (!(root instanceof HTMLElement)) return;

  const { authorizationRedirectUrl, platformOrigin, storageTarget, state, nonce } = root.dataset;
  if (!authorizationRedirectUrl || !platformOrigin || !storageTarget || !state || !nonce) return;

  const entries = [
    { key: \`state_\${state}\`, value: state },
    { key: \`nonce_\${nonce}\`, value: nonce },
  ];

  const redirect = () => window.location.replace(authorizationRedirectUrl);
  const parentWindow = window.parent !== window ? window.parent : window.opener;
  if (!parentWindow) {
    redirect();
    return;
  }

  const targetFrame = storageTarget === "_parent" ? parentWindow : parentWindow.frames[storageTarget];
  if (!targetFrame) {
    redirect();
    return;
  }

  const postToStorageFrame = (message) => {
    targetFrame.postMessage(JSON.stringify(message), platformOrigin);
  };

  const pending = new Set(entries.map((entry) => entry.key));
  const createMessageId = () => {
    if (crypto.randomUUID) return crypto.randomUUID();
    return \`lti-tool-\${Date.now()}-\${Math.random().toString(16).slice(2)}\`;
  };
  const messageIds = new Map(entries.map((entry) => [createMessageId(), entry.key]));
  const timeout = window.setTimeout(redirect, 1500);
  let storageMessagesPosted = false;

  const postStorageMessages = () => {
    if (storageMessagesPosted) return;
    storageMessagesPosted = true;

    for (const [messageId, key] of messageIds.entries()) {
      const entry = entries.find((candidate) => candidate.key === key);
      if (entry === undefined) continue;

      postToStorageFrame({
        subject: "lti.put_data",
        message_id: messageId,
        key: entry.key,
        value: entry.value,
      });
    }
  };

  window.addEventListener("message", (event) => {
    if (event.origin !== platformOrigin) return;

    let message = event.data;
    if (typeof message === "string") {
      try {
        message = JSON.parse(message);
      } catch {
        return;
      }
    }

    if (typeof message !== "object" || message === null) return;

    if (message.subject === "org.sakailms.lti.prelaunch.response") {
      postStorageMessages();
      return;
    }

    if (message.subject !== "lti.put_data.response") return;

    const key = messageIds.get(message.message_id);
    if (key === undefined) return;

    if (message.error === undefined) pending.delete(key);

    if (pending.size === 0) {
      window.clearTimeout(timeout);
      redirect();
    }
  });

  postToStorageFrame({ subject: "org.sakailms.lti.prelaunch" });
  window.setTimeout(postStorageMessages, 250);
})();`;
