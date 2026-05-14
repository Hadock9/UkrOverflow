/**
 * Розбір URL/шляху до матеріалу хабу для прив’язки поста спільноти.
 * @param {string} raw
 * @param {string} [baseOrigin='http://localhost'] — для відносних шляхів (у браузері зазвичай window.location.origin)
 */
export function parseHubMaterialUrl(raw, baseOrigin = 'http://localhost') {
  const s = String(raw || '').trim();
  if (!s) return { linkedContentType: null, linkedContentId: null };
  try {
    const u = s.includes('://') ? new URL(s) : new URL(s, baseOrigin);
    const m = u.pathname.match(/\/(questions|articles|guides|snippets|roadmaps|best-practices|faqs)\/(\d+)/);
    if (!m) return { linkedContentType: null, linkedContentId: null };
    const map = {
      questions: 'question',
      articles: 'article',
      guides: 'guide',
      snippets: 'snippet',
      roadmaps: 'roadmap',
      'best-practices': 'best_practice',
      faqs: 'faq',
    };
    const id = parseInt(m[2], 10);
    return {
      linkedContentType: map[m[1]] || null,
      linkedContentId: id > 0 ? id : null,
    };
  } catch {
    return { linkedContentType: null, linkedContentId: null };
  }
}
