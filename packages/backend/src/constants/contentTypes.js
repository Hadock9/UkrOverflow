import { CONTENT_TYPES, LINKABLE_HUB_TYPES } from '@ukroverflow/shared';

export { CONTENT_TYPES, LINKABLE_HUB_TYPES };

export const AVAILABLE_CONTENT_TYPES = [CONTENT_TYPES.QUESTION];

export function isSupportedContentType(type) {
  return AVAILABLE_CONTENT_TYPES.includes(type);
}
