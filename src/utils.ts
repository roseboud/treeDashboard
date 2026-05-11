// ── Stress colour scheme (preserve exactly) ────────────────────────────────
export const STRESS_COLORS: Record<string, string> = {
  Green: '#2ecc71',
  Yellow: '#f1c40f',
  Orange: '#e67e22',
  Red: '#e74c3c',
  NoLeaf: '#3498db',
};

// MAJORITY code → colour key (preserve mapping)
const CLASS_MAP: Record<number, { label: string; colour: string }> = {
  1: { label: 'High Stress', colour: 'Red' },
  2: { label: 'Moderate Stress', colour: 'Orange' },
  3: { label: 'Mild Stress', colour: 'Yellow' },
  5: { label: 'Leafless', colour: 'NoLeaf' },
  6: { label: 'Healthy', colour: 'Green' },
};

export function classColor(code: number | null | undefined): string {
  const info = code != null ? CLASS_MAP[code] : undefined;
  if (!info) return '#999';
  return STRESS_COLORS[info.colour] || '#999';
}

export function classDescription(code: number | null | undefined): string {
  const info = code != null ? CLASS_MAP[code] : undefined;
  if (!info) return `Unknown (${code ?? 'N'})`;
  return `${info.label} (${info.colour})`;
}

export function isTreeLayerName(name: string): boolean {
  return (
    name.includes('Tree') ||
    name.includes('Healthy') ||
    name.includes('Stress') ||
    name.includes('Leafless')
  );
}
