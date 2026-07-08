import { describe, expect, it } from 'vitest';

import {
  isLtiDeepLinkingContentTypeAccepted,
  parseLtiDeepLinkingSettings,
} from '../src/index.js';

describe('Deep Linking settings helpers', () => {
  it('parses and normalizes Deep Linking settings claims', () => {
    const parsed = parseLtiDeepLinkingSettings({
      deep_link_return_url: 'https://platform.example.com/deep_links',
      accept_types: ['link', 'file'],
      accept_presentation_document_targets: ['iframe', 'window'],
      accept_media_types: 'image/*,text/html',
      accept_multiple: true,
      accept_lineitem: true,
      auto_create: true,
      title: 'Default item title',
      text: 'Default item text',
      data: 'custom_data_123',
    });

    expect(parsed).toEqual({
      returnUrl: 'https://platform.example.com/deep_links',
      acceptTypes: ['link', 'file'],
      acceptPresentationDocumentTargets: ['iframe', 'window'],
      acceptMediaTypes: 'image/*,text/html',
      acceptMultiple: true,
      acceptLineItem: true,
      autoCreate: true,
      title: 'Default item title',
      text: 'Default item text',
      data: 'custom_data_123',
    });
  });

  it('preserves explicit false line item support', () => {
    const parsed = parseLtiDeepLinkingSettings({
      deep_link_return_url: 'https://platform.example.com/deep_links',
      accept_types: ['ltiResourceLink'],
      accept_presentation_document_targets: ['iframe'],
      accept_lineitem: false,
    });

    expect(parsed).toMatchObject({
      acceptLineItem: false,
    });
  });

  it('defaults optional booleans to false without assuming line item support', () => {
    const parsed = parseLtiDeepLinkingSettings({
      deep_link_return_url: 'https://platform.example.com/deep_links',
      accept_types: ['link'],
      accept_presentation_document_targets: ['iframe'],
    });

    expect(parsed).toEqual({
      returnUrl: 'https://platform.example.com/deep_links',
      acceptTypes: ['link'],
      acceptPresentationDocumentTargets: ['iframe'],
      acceptMultiple: false,
      autoCreate: false,
    });
    expect(parsed).not.toHaveProperty('acceptLineItem');
  });

  it('returns undefined when the claim is absent', () => {
    expect(parseLtiDeepLinkingSettings(undefined)).toBeUndefined();
  });

  it('rejects unknown Deep Linking settings keys', () => {
    expect(() =>
      parseLtiDeepLinkingSettings({
        deep_link_return_url: 'https://platform.example.com/deep_links',
        accept_types: ['ltiResourceLink'],
        accept_presentation_document_targets: ['iframe'],
        accept_line_item: true,
      }),
    ).toThrow();
  });

  it('validates accepted content types', () => {
    const parsed = parseLtiDeepLinkingSettings({
      deep_link_return_url: 'https://platform.example.com/deep_links',
      accept_types: ['link'],
      accept_presentation_document_targets: ['iframe'],
    });

    if (!parsed) throw new Error('Expected Deep Linking settings to parse');

    expect(isLtiDeepLinkingContentTypeAccepted(parsed, 'link')).toBe(true);
    expect(isLtiDeepLinkingContentTypeAccepted(parsed, 'file')).toBe(false);
  });
});
