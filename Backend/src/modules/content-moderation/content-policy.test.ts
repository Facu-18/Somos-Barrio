import { describe, it, expect } from 'vitest';
import { ContentPolicy } from './content-policy';

describe('ContentPolicy', () => {
  const policy = new ContentPolicy('test-1.0', [
    { id: '1', decision: 'BLOCK', type: 'EXACT_COMPACT', value: 'marihuana', categories: ['DRUGS'] },
    { id: '1b', decision: 'BLOCK', type: 'EXACT_COMPACT', value: 'droga', categories: ['DRUGS'] },
    { id: '2', decision: 'BLOCK', type: 'EXACT_TOKEN', value: 'pistola', categories: ['WEAPONS'] },
    { id: '3', decision: 'REVIEW', type: 'EXACT_TOKEN', value: 'boludo', categories: ['INSULT'] },
    { id: '4', decision: 'BLOCK', type: 'FUZZY', value: 'cocaina', maxDistance: 2, categories: ['DRUGS'] }
  ], ['madrugada', 'documento']);

  it('should allow normal text', () => {
    const res = policy.evaluate('Vendo bicicleta usada en buen estado', 'MARKETPLACE');
    expect(res.decision).toBe('ALLOW');
    expect(res.ruleId).toBe('ALLOW_DEFAULT');
    expect(res.ruleVersion).toBe('test-1.0');
    expect(res.domain).toBe('MARKETPLACE');
    expect(res.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should block EXACT_COMPACT match even with separators', () => {
    const res = policy.evaluate('Vendo m.a.r.i.h.u.a.n.a barata');
    expect(res.decision).toBe('BLOCK');
    expect(res.ruleId).toBe('1');
  });

  it('should allow exact compact false positives if tokens match allowlist', () => {
    // Si no pusiéramos 'madrugada' en allowlist, EXACT_COMPACT='droga' detectaría "ma-droga-da".
    // Como lo pusimos en allowlist, el heurístico debería ignorarlo.
    const res = policy.evaluate('A la madrugada salgo');
    expect(res.decision).toBe('ALLOW');
  });

  it('should block EXACT_TOKEN match', () => {
    const res = policy.evaluate('Vendo pistola calibre 22');
    expect(res.decision).toBe('BLOCK');
    expect(res.ruleId).toBe('2');
  });

  it('should review EXACT_TOKEN match', () => {
    const res = policy.evaluate('Che boludo veni');
    expect(res.decision).toBe('REVIEW');
    expect(res.ruleId).toBe('3');
  });

  it('should fuzzy match', () => {
    const res = policy.evaluate('Vendo cocaina');
    expect(res.decision).toBe('BLOCK');
    expect(res.ruleId).toBe('4');
    
    // Con error de ortografía (distancia 1)
    const res2 = policy.evaluate('Vendo cocana pura');
    expect(res2.decision).toBe('BLOCK');
    expect(res2.ruleId).toBe('4');
  });

  it('does not apply fuzzy matching to short terms', () => {
    const shortPolicy = new ContentPolicy('test-1.0', [
      { id: 'short', decision: 'BLOCK', type: 'FUZZY', value: 'arma', maxDistance: 1, categories: ['WEAPONS'] }
    ]);
    expect(shortPolicy.evaluate('armar un mueble').decision).toBe('ALLOW');
  });

  it('returns the same versioned decision on repeated evaluation', () => {
    expect(policy.evaluate('Vendo mаri\u200Bhuana')).toEqual(policy.evaluate('Vendo mаri\u200Bhuana'));
  });

  it('does not retain state from global regular expressions', () => {
    const regexPolicy = new ContentPolicy('test-1.0', [
      { id: 'regex', decision: 'REVIEW', type: 'REGEX', value: /sospechoso/g, categories: ['TEST'] }
    ]);
    expect(regexPolicy.evaluate('sospechoso')).toEqual(regexPolicy.evaluate('sospechoso'));
  });
});
