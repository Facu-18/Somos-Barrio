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
});
