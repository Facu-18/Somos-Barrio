import { describe, it, expect } from 'vitest';
import { ContentNormalizer } from './content-normalizer';

describe('ContentNormalizer', () => {
  it('should remove diacritics and lowercases', () => {
    expect(ContentNormalizer.normalize('Hólá Múndó')).toBe('hola mundo');
  });

  it('is deterministic and idempotent', () => {
    const normalized = ContentNormalizer.normalize('  HÓLÁ\u200B   BARRIO  ');
    expect(normalized).toBe('hola barrio');
    expect(ContentNormalizer.normalize(normalized)).toBe(normalized);
  });

  it('normalizes full-width, invisible and cross-alphabet confusables', () => {
    expect(ContentNormalizer.normalize('ｍаri\u00ADhuana')).toBe('marihuana');
    expect(ContentNormalizer.compact('ｍаr.i\u202Eh.u.a.n.a')).toBe('marihuana');
  });

  it('should convert leetspeak', () => {
    expect(ContentNormalizer.convertLeetspeak('m@r1hu4n4')).toBe('marihuana');
    expect(ContentNormalizer.convertLeetspeak('b0lud0')).toBe('boludo');
  });

  it('should collapse repetitions', () => {
    expect(ContentNormalizer.collapseRepetitions('hoooolaaaa')).toBe('hola');
    expect(ContentNormalizer.collapseRepetitions('maarihuuuana')).toBe('marihuana');
  });

  it('should compact text', () => {
    expect(ContentNormalizer.compact('M.@.r.1.h.u.4.n.A!!!')).toBe('marihuana');
    expect(ContentNormalizer.compact('m a r i h u a n a')).toBe('marihuana');
    expect(ContentNormalizer.compact('c-o_c*a/i+n-a')).toBe('cocaina');
    expect(ContentNormalizer.compact('marhiu4na')).toBe('marhiuana');
  });

  it('should tokenize correctly', () => {
    expect(ContentNormalizer.tokenize('hola, ¿como estas?')).toEqual(['hola', 'como', 'estas']);
    expect(ContentNormalizer.tokenize('v3nd0 m@r1hu4n4 barata')).toEqual(['vendo', 'marihuana', 'barata']);
  });
});
