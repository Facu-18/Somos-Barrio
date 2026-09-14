import { createHash } from 'node:crypto';
import { ContentNormalizer } from './content-normalizer';

export type Decision = 'ALLOW' | 'REVIEW' | 'BLOCK';

export interface PolicyRule {
  id: string;
  decision: Decision;
  type: 'EXACT_TOKEN' | 'EXACT_PHRASE' | 'EXACT_COMPACT' | 'REGEX' | 'FUZZY';
  value: string | RegExp;
  categories: string[];
  maxDistance?: number; // Sólo usado si type es FUZZY
  version?: string;
  domains?: Array<'MARKETPLACE' | 'FORUM'>;
  // Solo REGEX: 'COMPACT' (default) ignora espacios y separadores; 'NORMALIZED' conserva
  // los límites de palabra para frases literales.
  target?: 'COMPACT' | 'NORMALIZED';
  // 'shadow' evalúa la regla y registra coincidencias sin afectar la decisión: sirve para medir
  // falsos positivos antes de endurecerla. También se activa por id con MODERATION_SHADOW_RULES.
  mode?: 'enforce' | 'shadow';
}

export interface ShadowMatch {
  ruleId: string;
  decision: Decision;
  categories: string[];
}

export interface ModerationResult {
  decision: Decision;
  ruleId: string;
  ruleVersion: string;
  policyVersion: string;
  domain: 'MARKETPLACE' | 'FORUM' | 'SHARED';
  severity: 'NONE' | 'MEDIUM' | 'HIGH';
  contentHash: string;
  categories: string[];
  shadowMatches: ShadowMatch[];
}

export class ContentPolicy {
  public version: string;
  public rules: PolicyRule[];
  public allowlist: Set<string>; // Palabras compactas permitidas
  private readonly shadowRuleIds: Set<string>;

  constructor(version: string, rules: PolicyRule[], allowlist: string[] = [], shadowRuleIds: Iterable<string> = []) {
    this.version = version;
    this.rules = rules;
    this.allowlist = new Set(allowlist.map(w => ContentNormalizer.compact(w)));
    this.shadowRuleIds = new Set(shadowRuleIds);
  }

  private isShadow(rule: PolicyRule) {
    return rule.mode === 'shadow' || this.shadowRuleIds.has(rule.id);
  }

  public evaluate(text: string, domain: ModerationResult['domain'] = 'SHARED'): ModerationResult {
    const views = ContentNormalizer.buildViews(text);
    const compactText = views.compact;
    const tokens = views.tokens;
    const contentHash = createHash('sha256').update(views.normalized).digest('hex');

    let finalDecision: Decision = 'ALLOW';
    let matchedRule: PolicyRule | undefined;
    let matchedCategories: string[] = [];
    const shadowMatches: ShadowMatch[] = [];

    // Si todo el texto compacto está en la allowlist
    if (this.allowlist.has(compactText)) {
      return this.result('ALLOW', undefined, domain, contentHash, [], shadowMatches);
    }

    for (const rule of this.rules) {
      if (domain !== 'SHARED' && rule.domains && !rule.domains.includes(domain)) continue;

      let isMatch = false;

      if (rule.type === 'EXACT_TOKEN') {
        const val = rule.value as string;
        // Buscamos coincidencia exacta en algún token (y que el token no esté permitido)
        if (tokens.includes(val) && !this.allowlist.has(val)) {
          isMatch = true;
        }
      } else if (rule.type === 'EXACT_PHRASE') {
        const val = ContentNormalizer.normalize(rule.value as string);
        isMatch = ` ${views.normalized} `.includes(` ${val} `);
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
        regex.lastIndex = 0;
        if (regex.test(rule.target === 'NORMALIZED' ? views.normalized : compactText)) {
          isMatch = true;
        }
        regex.lastIndex = 0;
      } else if (rule.type === 'FUZZY') {
        const val = rule.value as string;
        const maxD = rule.maxDistance || 1;

        if (val.length < 6) continue;
        
        // El fuzzy debe buscar coincidencias en cada token, no en todo el string compacto
        for (const token of tokens) {
          if (this.allowlist.has(token)) continue;
          
          if (this.levenshtein(token, val) <= maxD) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch && this.isShadow(rule)) {
        shadowMatches.push({ ruleId: rule.id, decision: rule.decision, categories: rule.categories });
        continue;
      }

      if (isMatch) {
        if (rule.decision === 'BLOCK') {
          return this.result('BLOCK', rule, domain, contentHash, rule.categories, shadowMatches);
        } else if (rule.decision === 'REVIEW') {
          // La primera regla de revisión identifica la decisión; las categorías se acumulan
          // para que una regla genérica no oculte otra más específica.
          finalDecision = 'REVIEW';
          matchedRule ??= rule;
          matchedCategories = [...new Set([...matchedCategories, ...rule.categories])];
        }
      }
    }

    return this.result(finalDecision, matchedRule, domain, contentHash, matchedCategories, shadowMatches);
  }

  private result(
    decision: Decision,
    rule: PolicyRule | undefined,
    domain: ModerationResult['domain'],
    contentHash: string,
    categories: string[],
    shadowMatches: ShadowMatch[]
  ): ModerationResult {
    return {
      decision,
      ruleId: rule?.id ?? 'ALLOW_DEFAULT',
      ruleVersion: rule?.version ?? this.version,
      policyVersion: this.version,
      domain,
      severity: decision === 'BLOCK' ? 'HIGH' : decision === 'REVIEW' ? 'MEDIUM' : 'NONE',
      contentHash,
      categories,
      shadowMatches
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
