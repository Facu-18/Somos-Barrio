const CONFUSABLES: Record<string, string> = {
  // Cyrillic and Greek glyphs that are visually indistinguishable from Latin.
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', к: 'k', м: 'm', т: 't', в: 'b', н: 'h',
  α: 'a', ε: 'e', ο: 'o', ρ: 'p', κ: 'k', τ: 't', υ: 'y', χ: 'x', ι: 'i'
};

export interface NormalizedContent {
  original: string;
  normalized: string;
  compact: string;
  tokens: string[];
}

export class ContentNormalizer {
  static normalize(text: string): string {
    return Array.from(
      text
        .normalize('NFKC')
        .toLocaleLowerCase('es-AR')
        .replace(/[\u00AD\u034F\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .normalize('NFC')
    )
      .map((character) => CONFUSABLES[character] ?? character)
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static convertLeetspeak(text: string): string {
    const substitutions: Record<string, string> = {
      '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's'
    };

    if (!/[a-z]/i.test(text) || !/[013457@$]/.test(text)) return text;
    return text.replace(/[013457@$]/g, (character) => substitutions[character] ?? character);
  }

  static collapseRepetitions(text: string): string {
    return text
      .replace(/([aeiou])\1+/g, '$1')
      .replace(/([^aeiou\W])\1{2,}/g, '$1');
  }

  static compact(text: string): string {
    const detectionView = this.collapseRepetitions(this.convertLeetspeak(this.normalize(text)));
    return detectionView.replace(/[^a-z0-9]/g, '');
  }

  static tokenize(text: string): string[] {
    return this.collapseRepetitions(this.convertLeetspeak(this.normalize(text)))
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  }

  static buildViews(text: string): NormalizedContent {
    return {
      original: text,
      normalized: this.normalize(text),
      compact: this.compact(text),
      tokens: this.tokenize(text)
    };
  }
}
