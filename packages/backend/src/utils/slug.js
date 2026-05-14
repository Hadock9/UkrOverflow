/**
 * Slug-генератор з підтримкою кирилиці.
 */

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye',
  ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'i', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '',
  ю: 'yu', я: 'ya', ё: 'e', ы: 'y', ъ: '', э: 'e',
};

export function slugify(input) {
  const lower = String(input || '').toLowerCase().trim();
  let out = '';
  for (const ch of lower) {
    if (TRANSLIT[ch] !== undefined) {
      out += TRANSLIT[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else {
      out += '-';
    }
  }
  return out
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

export function uniqueSlug(base, takenSet) {
  let s = base || 'item';
  if (!takenSet.has(s)) {
    takenSet.add(s);
    return s;
  }
  let i = 2;
  while (takenSet.has(`${s}-${i}`)) i += 1;
  const u = `${s}-${i}`;
  takenSet.add(u);
  return u;
}

export default slugify;
