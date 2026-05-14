import { describe, it, expect } from 'vitest';
import { CONTENT_TYPES, getContentDetailPath, getContentTypeMeta } from './contentTypes.js';

describe('getContentDetailPath', () => {
  it('будує шляхи для хабу та поста спільноти', () => {
    expect(getContentDetailPath(CONTENT_TYPES.QUESTION, 5)).toBe('/questions/5');
    expect(getContentDetailPath(CONTENT_TYPES.COMMUNITY_POST, 12)).toBe('/community-posts/12');
    expect(getContentDetailPath(CONTENT_TYPES.FAQ, 3)).toBe('/faqs/3');
  });
});

describe('getContentTypeMeta', () => {
  it('має метадані для community_post', () => {
    const m = getContentTypeMeta(CONTENT_TYPES.COMMUNITY_POST);
    expect(m.shortLabel).toMatch(/спільнот/i);
  });
});
