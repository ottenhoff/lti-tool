import { describe, expect, it } from 'vitest';

import {
  createLtiPostMessageStorageRedirect,
  renderLtiPostMessageStorageRedirectPage,
} from '../src/index.js';

describe('LTI postMessage storage helpers', () => {
  it('builds redirect input from an authorization redirect URL and storage target', () => {
    const redirect = createLtiPostMessageStorageRedirect({
      authorizationRedirectUrl:
        'https://platform.example.com/authorize?state=state123&nonce=nonce123',
      storageTarget: '_parent',
    });

    expect(redirect).toEqual({
      authorizationRedirectUrl:
        'https://platform.example.com/authorize?state=state123&nonce=nonce123',
      platformOrigin: 'https://platform.example.com',
      storageTarget: '_parent',
      state: 'state123',
      nonce: 'nonce123',
    });
  });

  it('returns null when storage target, state, or nonce is absent', () => {
    expect(
      createLtiPostMessageStorageRedirect({
        authorizationRedirectUrl:
          'https://platform.example.com/authorize?state=state123&nonce=nonce123',
      }),
    ).toBeNull();
    expect(
      createLtiPostMessageStorageRedirect({
        authorizationRedirectUrl: 'https://platform.example.com/authorize?nonce=nonce123',
        storageTarget: '_parent',
      }),
    ).toBeNull();
    expect(
      createLtiPostMessageStorageRedirect({
        authorizationRedirectUrl: 'https://platform.example.com/authorize?state=state123',
        storageTarget: '_parent',
      }),
    ).toBeNull();
  });

  it('renders escaped storage redirect HTML with the postMessage flow script', () => {
    const html = renderLtiPostMessageStorageRedirectPage({
      authorizationRedirectUrl:
        'https://platform.example.com/authorize?state=abc&nonce=def&next=<script>',
      platformOrigin: 'https://platform.example.com',
      storageTarget: 'frame"name',
      state: 'abc',
      nonce: 'def',
    });

    expect(html).toContain('id="lti-post-message-storage-redirect"');
    expect(html).toContain('data-storage-target="frame&quot;name"');
    expect(html).toContain('next=&lt;script&gt;');
    expect(html).toContain('subject: "lti.put_data"');
    expect(html).toContain('org.sakailms.lti.prelaunch');
  });
});
