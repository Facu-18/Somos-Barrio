import { ContentNormalizer } from './content-normalizer';

export type Decision = 'ALLOW' | 'REVIEW' | 'BLOCK';

export interface PolicyRule {
  id: string;
  decision: Decision;
  type: 'EXACT_TOKEN' | 'EXACT_COMPACT' | 'REGEX' | 'FUZZY';
  value: string | RegExp;
  categories: string[];
  maxDistance?: number; // Sólo usado si type es FUZZY
}

export interface ModerationResult {
  decision: Decision;
  ruleId?: string;
  policyVersion: string;
  categories: string[];
}

export class ContentPolicy {
  public version: string;
  public rules: PolicyRule[];
  public allowlist: Set<string>; // Palabras compactas permitidas

  constructor(version: string, rules: PolicyRule[], allowlist: string[] = []) {
    this.version = version;
    this.rules = rules;
    this.allowlist = new Set(allowlist.map(w => ContentNormalizer.compact(w)));
  }

  public evaluate(text: string): ModerationResult {
    const compactText = ContentNormalizer.compact(text);
    const tokens = ContentNormalizer.tokenize(text);

    let finalDecision: Decision = 'ALLOW';
    let matchedRuleId: string | undefined;
    let matchedCategories: string[] = [];

    // Si todo el texto compacto está en la allowlist
    if (this.allowlist.has(compactText)) {
      return { decision: 'ALLOW', policyVersion: this.version, categories: [] };
    }

    for (const rule of this.rules) {
      let isMatch = false;

      if (rule.type === 'EXACT_TOKEN') {
        const val = rule.value as string;
        // Buscamos coincidencia exacta en algún token (y que el token no esté permitido)
        if (tokens.includes(val) && !this.allowlist.has(val)) {
          isMatch = true;
        }
      } else if (rule.type === 'EXACT_COMPACT') {
        const val = rule.value as string;
        // Buscamos coincidencia en el texto compacto. 
        // Riesgoso para palabras cortas (falsos positivos), ideal para ofuscaciones largas.
        if (compactText.includes(val)) {
          // Chequeo básico: si el match está dentro de un token permitido, lo ignoramos.
          // Ejemplo: val="droga", token="madrogada" (permitido)
          if (!this.isCompactMatchWhitelisted(val, compactText, tokens)) {
             isMatch = true;
          }
        }
      } else if (rule.type === 'REGEX') {
        const regex = rule.value as RegExp;
        if (regex.test(compactText)) {
          isMatch = true;
        }
      } else if (rule.type === 'FUZZY') {
        const val = rule.value as string;
        const maxD = rule.maxDistance || 1;
        
        // El fuzzy debe buscar coincidencias en cada token, no en todo el string compacto
        for (const token of tokens) {
          if (this.allowlist.has(token)) continue;
          
          if (this.levenshtein(token, val) <= maxD) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch) {
        if (rule.decision === 'BLOCK') {
          return {
            decision: 'BLOCK',
            ruleId: rule.id,
            policyVersion: this.version,
            categories: rule.categories
          };
        } else if (rule.decision === 'REVIEW') {
          finalDecision = 'REVIEW';
          matchedRuleId = rule.id;
          matchedCategories = rule.categories;
        }
      }
    }

    return {
      decision: finalDecision,
      ruleId: matchedRuleId,
      policyVersion: this.version,
      categories: matchedCategories
    };
  }

  /**
   * Intenta detectar si el match EXACT_COMPACT sucedió únicamente dentro de palabras
   * permitidas. (Es un heurístico simple).
   */
  private isCompactMatchWhitelisted(matchVal: string, compactText: string, tokens: string[]): boolean {
    for (const t of tokens) {
      if (t.includes(matchVal) && this.allowlist.has(t)) {
         return true; // Match está cubierto por un token permitido
      }
    }
    return false;
  }

  /**
   * Distancia de Levenshtein clásica.
   */
  private levenshtein(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array.from({ length: b.length + 1 }, () => Array(a.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        if (b.charAt(j - 1) === a.charAt(i - 1)) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i - 1] + 1, // sustitución
            matrix[j][i - 1] + 1,     // inserción
            matrix[j - 1][i] + 1      // borrado
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }
}
