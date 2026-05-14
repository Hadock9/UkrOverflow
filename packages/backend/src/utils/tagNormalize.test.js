import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTag, normalizeTagList } from './tagNormalize.js';

describe('tagNormalize', () => {
  it('normalizeTag мапить синоніми', () => {
    assert.equal(normalizeTag('JS'), 'javascript');
    assert.equal(normalizeTag('ts'), 'typescript');
    assert.equal(normalizeTag('unknown'), 'unknown');
  });

  it('normalizeTagList прибирає дублікати й порожні', () => {
    assert.deepEqual(normalizeTagList(['js', 'JS', 'react']), ['javascript', 'react']);
    assert.deepEqual(normalizeTagList(['', '  ', 'go']), ['go']);
  });
});
