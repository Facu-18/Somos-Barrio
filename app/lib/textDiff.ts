export type DiffPart = { type: 'equal' | 'added' | 'removed'; text: string };

// Por encima de este tamaño la tabla LCS por palabras es cara en un teléfono; se compara por oraciones.
const MAX_CELLS = 250_000;

const tokenizeWords = (text: string) => text.match(/\s+|[^\s]+/g) ?? [];
const tokenizeSentences = (text: string) => text.match(/[^.!?\n]+[.!?]*\s*|\n+/g) ?? [];

function lcsDiff(before: string[], after: string[]): DiffPart[] {
  const rows = before.length + 1;
  const cols = after.length + 1;
  const table = new Uint32Array(rows * cols);

  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] = before[i] === after[j]
        ? table[(i + 1) * cols + j + 1] + 1
        : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (type: DiffPart['type'], text: string) => {
    const last = parts[parts.length - 1];
    if (last?.type === type) last.text += text;
    else parts.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      push('equal', before[i]);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
      push('removed', before[i]);
      i += 1;
    } else {
      push('added', after[j]);
      j += 1;
    }
  }
  while (i < before.length) push('removed', before[i++]);
  while (j < after.length) push('added', after[j++]);
  return parts;
}

export function diffText(before: string, after: string): DiffPart[] {
  if (before === after) return before ? [{ type: 'equal', text: before }] : [];
  const a = tokenizeWords(before);
  const b = tokenizeWords(after);

  // El prefijo y el sufijo comunes no necesitan LCS: así una corrección puntual en un texto largo sigue siendo por palabras.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const middleA = a.slice(start, endA);
  const middleB = b.slice(start, endB);
  const middle = middleA.length * middleB.length <= MAX_CELLS
    ? lcsDiff(middleA, middleB)
    : lcsDiff(tokenizeSentences(middleA.join('')), tokenizeSentences(middleB.join('')));

  const parts: DiffPart[] = [];
  const prefix = a.slice(0, start).join('');
  const suffix = a.slice(endA).join('');
  if (prefix) parts.push({ type: 'equal', text: prefix });
  parts.push(...middle);
  if (suffix) parts.push({ type: 'equal', text: suffix });
  return parts;
}

export const hasChanges = (parts: DiffPart[]) => parts.some((part) => part.type !== 'equal' && part.text.trim() !== '');
