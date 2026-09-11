export class ContentNormalizer {
  /**
   * Normaliza el texto usando NFKC, quita marcas de puntuación invisibles,
   * caracteres zero-width, diacríticos (tildes), y pasa a minúsculas.
   */
  static normalize(text: string): string {
    return text
      .normalize('NFD') // Decompose characters to base + diacritic
      .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
      .normalize('NFKC') // Recompose and standardize widths/compatibility
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g, ''); // Remove zero-width and Bidi marks
  }

  /**
   * Traduce leetspeak básico a letras.
   */
  static convertLeetspeak(text: string): string {
    const map: Record<string, string> = {
      '0': 'o',
      '1': 'i',
      '3': 'e',
      '4': 'a',
      '5': 's',
      '7': 't',
      '@': 'a',
      '$': 's'
    };
    return text.replace(/[013457@$]/g, (char) => map[char] || char);
  }

  /**
   * Elimina letras repetidas consecutivas (ej. "maarihuuuana" -> "marihuana").
   */
  static collapseRepetitions(text: string): string {
    return text.replace(/(.)\1+/g, '$1');
  }

  /**
   * Devuelve una versión ultra-compacta para buscar palabras escondidas con separadores.
   * (ej. "m.a.r.i.h.u.a.n.a" -> "marihuana")
   */
  static compact(text: string): string {
    let t = this.normalize(text);
    t = this.convertLeetspeak(t);
    t = t.replace(/[^a-z0-9]/g, '');
    return this.collapseRepetitions(t);
  }

  /**
   * Devuelve un arreglo de tokens (palabras) normalizados, sin compactar del todo,
   * manteniendo la separación entre palabras, útil para reglas de matcheo exacto.
   */
  static tokenize(text: string): string[] {
    let t = this.normalize(text);
    t = this.convertLeetspeak(t);
    // Dividir por cualquier caracter que no sea letra o número
    return t.split(/[^a-z0-9]+/).filter(w => w.length > 0).map(w => this.collapseRepetitions(w));
  }
}
