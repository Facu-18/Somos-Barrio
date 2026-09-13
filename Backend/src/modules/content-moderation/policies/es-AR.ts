import { PolicyRule } from '../content-policy';

export const allowlistEsAR = [
  'madrugada', // para evitar falso positivo con 'droga' si usáramos EXACT_COMPACT
  'analisis',
  'documento',
  'armario',
  'repuesto',
  'cocina',
  'medicamento'
];

export const rulesEsAR: PolicyRule[] = [
  // Armas y drogas: se bloquea su comercialización. En el foro los vecinos
  // mencionan estas palabras para denunciar hechos ("a punta de pistola"),
  // por eso estas reglas solo aplican al marketplace.
  {
    id: 'AR-WPN-1',
    decision: 'BLOCK',
    type: 'EXACT_TOKEN',
    value: 'pistola',
    categories: ['WEAPONS'],
    domains: ['MARKETPLACE']
  },
  {
    id: 'AR-WPN-2',
    decision: 'BLOCK',
    type: 'EXACT_TOKEN',
    value: 'revolver',
    categories: ['WEAPONS'],
    domains: ['MARKETPLACE']
  },
  {
    id: 'AR-WPN-3',
    decision: 'BLOCK',
    type: 'EXACT_TOKEN',
    value: 'municiones',
    categories: ['WEAPONS'],
    domains: ['MARKETPLACE']
  },

  // Drogas
  {
    id: 'AR-DRG-1',
    decision: 'BLOCK',
    type: 'EXACT_COMPACT', // Buscamos ofuscaciones como m.a.r.i.h.u.a.n.a
    value: 'marihuana',
    categories: ['DRUGS'],
    domains: ['MARKETPLACE']
  },
  {
    id: 'AR-DRG-2',
    decision: 'BLOCK',
    type: 'EXACT_COMPACT',
    value: 'cocaina',
    categories: ['DRUGS'],
    domains: ['MARKETPLACE']
  },
  {
    id: 'AR-DRG-3',
    decision: 'REVIEW',
    type: 'FUZZY', // Por si escriben mariguana, marhuana, etc.
    value: 'marihuana',
    maxDistance: 2,
    categories: ['DRUGS'],
    domains: ['MARKETPLACE']
  },
  {
    id: 'AR-DRG-4',
    decision: 'REVIEW',
    type: 'FUZZY',
    value: 'cocaina',
    maxDistance: 2,
    categories: ['DRUGS'],
    domains: ['MARKETPLACE']
  },

  // Amenazas: la frase literal se bloquea; la variante ofuscada va a revisión.
  {
    id: 'AR-THR-1',
    decision: 'BLOCK',
    type: 'REGEX',
    value: /\b(te|los|las|lo|la) (voy|vamos) a (matar|pegar un tiro|cagar a tiros|prender fuego)\b/,
    categories: ['THREAT'],
    target: 'NORMALIZED'
  },
  {
    id: 'AR-THR-2',
    decision: 'BLOCK',
    type: 'REGEX',
    value: /\bte (pego|meto) un tiro\b/,
    categories: ['THREAT'],
    target: 'NORMALIZED'
  },
  {
    id: 'AR-THR-3',
    decision: 'REVIEW',
    type: 'REGEX',
    value: /(te|los|las)(voy|vamos)a(matar|pegaruntiro|cagaratiros)|te(pego|meto)untiro/,
    categories: ['THREAT']
  },

  // Insultos graves
  {
    id: 'AR-INS-G1',
    decision: 'BLOCK',
    type: 'REGEX',
    value: /\b(hij[oa]s? de (re)?puta|la concha de tu (madre|hermana))\b/,
    categories: ['INSULT'],
    target: 'NORMALIZED'
  },
  {
    id: 'AR-INS-G2',
    decision: 'REVIEW',
    type: 'REGEX',
    value: /hij[oa]s?de(re)?puta|conchadetu(madre|hermana)/,
    categories: ['INSULT']
  },
  {
    id: 'AR-INS-G3',
    decision: 'REVIEW',
    type: 'EXACT_TOKEN',
    value: 'hdp',
    categories: ['INSULT']
  },

  // Discriminación inequívoca
  {
    id: 'AR-DIS-1',
    decision: 'BLOCK',
    type: 'REGEX',
    value: /\b(negr[oa]s?|viller[oa]s?|bolitas?|peruch[oa]s?|judi[oa]s?|putos?|travas?) de mierda\b/,
    categories: ['DISCRIMINATION'],
    target: 'NORMALIZED'
  },
  {
    id: 'AR-DIS-2',
    decision: 'REVIEW',
    type: 'REGEX',
    value: /(negr[oa]|viller[oa]|bolita|peruch[oa]|judi[oa]|puto|trava)s?demierda/,
    categories: ['DISCRIMINATION']
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
