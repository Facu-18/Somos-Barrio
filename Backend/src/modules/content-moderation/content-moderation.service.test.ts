import { describe, it, expect } from 'vitest';
import { contentModerationService } from './content-moderation.service';

describe('ContentModerationService', () => {
  it('should evaluate text against default policy (es-AR)', () => {
    // Texto normal
    const res1 = contentModerationService.evaluate('Vendo auto 2015 en excelente estado', 'MARKETPLACE');
    expect(res1.decision).toBe('ALLOW');

    // Arma (BLOCK)
    const res2 = contentModerationService.evaluate('Busco municiones', 'MARKETPLACE');
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

  describe('FORUM', () => {
    it.each([
      ['Si te veo de nuevo te voy a matar', 'THREAT'],
      ['Te pego un tiro si seguís', 'THREAT'],
      ['Sos un hijo de puta', 'INSULT'],
      ['La concha de tu madre', 'INSULT'],
      ['Estos negros de mierda del fondo', 'DISCRIMINATION'],
      ['Los villeros de mierda otra vez', 'DISCRIMINATION'],
      ['Judíos de mierda', 'DISCRIMINATION']
    ])('bloquea contenido grave: %s', (text, category) => {
      const result = contentModerationService.evaluate(text, 'FORUM');
      expect(result.decision).toBe('BLOCK');
      expect(result.categories).toContain(category);
      expect(result.domain).toBe('FORUM');
    });

    it.each([
      ['t3 v0y a m4tar', 'THREAT'],
      ['te-voy-a-matar', 'THREAT'],
      ['h.i.j.o d.e p.u.t.a', 'INSULT'],
      ['sos un hdp', 'INSULT'],
      ['n3gr0s d3 m1erda', 'DISCRIMINATION'],
      ['sos un pelotudo', 'INSULT']
    ])('envía ofuscaciones y ambigüedades a revisión: %s', (text, category) => {
      const result = contentModerationService.evaluate(text, 'FORUM');
      expect(result.decision).toBe('REVIEW');
      expect(result.categories).toContain(category);
    });

    it.each([
      'Me asaltaron a punta de pistola en la esquina',
      'Hay chicos fumando marihuana en la plaza, avisen a la comisaría',
      'Encontré municiones tiradas en el baldío',
      'Ayer me mataron de risa en la reunión del club',
      '¿Alguien sabe a qué hora pasa el basurero?'
    ])('permite denuncias y conversación vecinal: %s', (text) => {
      expect(contentModerationService.evaluate(text, 'FORUM').decision).toBe('ALLOW');
    });

    it('no bloquea una grosería que no apunta a un grupo', () => {
      const result = contentModerationService.evaluate('Los paraguas de mierda del chino se rompen enseguida', 'FORUM');
      expect(result.decision).toBe('REVIEW');
      expect(result.categories).not.toContain('DISCRIMINATION');
    });
  });
});
