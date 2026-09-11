import { PolicyRule } from '../content-policy';

export const allowlistEsAR = [
  'madrugada', // para evitar falso positivo con 'droga' si usáramos EXACT_COMPACT
  'analisis',  
  'documento'
];

export const rulesEsAR: PolicyRule[] = [
  // Armas
  {
    id: 'AR-WPN-1',
    decision: 'BLOCK',
    type: 'EXACT_TOKEN',
    value: 'pistola',
    categories: ['WEAPONS']
  },
  {
    id: 'AR-WPN-2',
    decision: 'BLOCK',
    type: 'EXACT_TOKEN',
    value: 'revolver',
    categories: ['WEAPONS']
  },
  {
    id: 'AR-WPN-3',
    decision: 'BLOCK',
    type: 'EXACT_TOKEN',
    value: 'municiones',
    categories: ['WEAPONS']
  },
  
  // Drogas
  {
    id: 'AR-DRG-1',
    decision: 'BLOCK',
    type: 'EXACT_COMPACT', // Buscamos ofuscaciones como m.a.r.i.h.u.a.n.a
    value: 'marihuana',
    categories: ['DRUGS']
  },
  {
    id: 'AR-DRG-2',
    decision: 'BLOCK',
    type: 'EXACT_COMPACT',
    value: 'cocaina',
    categories: ['DRUGS']
  },
  {
    id: 'AR-DRG-3',
    decision: 'BLOCK',
    type: 'FUZZY', // Por si escriben mariguana, marhuana, etc.
    value: 'marihuana',
    maxDistance: 2,
    categories: ['DRUGS']
  },
  {
    id: 'AR-DRG-4',
    decision: 'BLOCK',
    type: 'FUZZY',
    value: 'cocaina',
    maxDistance: 2,
    categories: ['DRUGS']
  },

  // Insultos / Ofensas (REVIEW)
  {
    id: 'AR-INS-1',
    decision: 'REVIEW',
    type: 'EXACT_TOKEN',
    value: 'boludo',
    categories: ['INSULT']
  },
  {
    id: 'AR-INS-2',
    decision: 'REVIEW',
    type: 'EXACT_TOKEN',
    value: 'pelotudo',
    categories: ['INSULT']
  },
  {
    id: 'AR-INS-3',
    decision: 'REVIEW',
    type: 'EXACT_TOKEN',
    value: 'puto',
    categories: ['INSULT']
  },
  {
    id: 'AR-INS-4',
    decision: 'REVIEW',
    type: 'EXACT_TOKEN',
    value: 'mierda',
    categories: ['INSULT']
  }
];
