import { describe, it, expect } from 'vitest';
import { contentModerationService } from './content-moderation.service';

describe('ContentModerationService', () => {
  it('should evaluate text against default policy (es-AR)', () => {
    // Texto normal
    const res1 = contentModerationService.evaluate('Vendo auto 2015 en excelente estado', 'MARKETPLACE');
    expect(res1.decision).toBe('ALLOW');

    // Arma (BLOCK)
    const res2 = contentModerationService.evaluate('Busco municiones', 'FORUM');
    expect(res2.decision).toBe('BLOCK');
    expect(res2.categories).toContain('WEAPONS');

    // Insulto (REVIEW)
    const res3 = contentModerationService.evaluate('sos un pelotudo importante', 'FORUM');
    expect(res3.decision).toBe('REVIEW');
    expect(res3.categories).toContain('INSULT');

    // Droga ofuscada (BLOCK)
    const res4 = contentModerationService.evaluate('v3nd0 m.a.r.i.h.u.a.n.a fresssca', 'MARKETPLACE');
    expect(res4.decision).toBe('BLOCK');
    expect(res4.categories).toContain('DRUGS');
  });

  it.each([
    'Vendo marhiu4na',
    'Vendo ｍａｒｉｈｕａｎａ',
    'Vendo mаri\u200Bhuana',
    'Vendo m-a-r-i-h-u-a-n-a'
  ])('keeps agreed evasion out of the allow path: %s', (text) => {
    const result = contentModerationService.evaluate(text, 'MARKETPLACE');
    expect(result.decision).not.toBe('ALLOW');
    expect(result.domain).toBe('MARKETPLACE');
    expect(result.ruleVersion).toBeTruthy();
  });

  it.each([
    'Vendo armario de cocina',
    'Repuesto original para bicicleta',
    'Documento encontrado en la madrugada',
    'Medicamento con receta, sin venta'
  ])('allows Argentine Spanish false-positive regression: %s', (text) => {
    expect(contentModerationService.evaluate(text, 'MARKETPLACE').decision).toBe('ALLOW');
  });
});
