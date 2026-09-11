import { describe, it, expect } from 'vitest';
import { ContentNormalizer } from './content-normalizer';

describe('ContentNormalizer', () => {
  it('should remove diacritics and lowercases', () => {
    expect(ContentNormalizer.normalize('Hólá Múndó')).toBe('hola mundo');
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
  });

  it('should tokenize correctly', () => {
    expect(ContentNormalizer.tokenize('hola, ¿como estas?')).toEqual(['hola', 'como', 'estas']);
    expect(ContentNormalizer.tokenize('v3nd0 m@r1hu4n4 barata')).toEqual(['vendo', 'marihuana', 'barata']);
  });
});
