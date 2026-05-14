import { describe, it, expect } from 'vitest';
import { parseHubMaterialUrl } from './hubLinkParse.js';

describe('parseHubMaterialUrl', () => {
  it('повертає null для порожнього рядка', () => {
    expect(parseHubMaterialUrl('')).toEqual({ linkedContentType: null, linkedContentId: null });
    expect(parseHubMaterialUrl('   ')).toEqual({ linkedContentType: null, linkedContentId: null });
  });

  it('парсить відносний шлях з базою', () => {
    expect(parseHubMaterialUrl('/snippets/12', 'https://devflow.test')).toEqual({
      linkedContentType: 'snippet',
      linkedContentId: 12,
    });
  });

  it('парсить повний URL', () => {
    expect(parseHubMaterialUrl('https://x.com/questions/99/anything')).toEqual({
      linkedContentType: 'question',
      linkedContentId: 99,
    });
  });

  it('обробляє best-practices та faqs', () => {
    expect(parseHubMaterialUrl('/best-practices/5', 'http://localhost')).toEqual({
      linkedContentType: 'best_practice',
      linkedContentId: 5,
    });
    expect(parseHubMaterialUrl('/faqs/3', 'http://localhost')).toEqual({
      linkedContentType: 'faq',
      linkedContentId: 3,
    });
  });

  it('для невідомого шляху повертає null', () => {
    expect(parseHubMaterialUrl('/users/1', 'http://localhost')).toEqual({
      linkedContentType: null,
      linkedContentId: null,
    });
  });
});
