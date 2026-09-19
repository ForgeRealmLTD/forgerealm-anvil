// Navy→amber colour ramp for data-viz. The low end sits just above the card
// surface so zero reads as "quiet", not "missing"; the high end is the brand
// amber pushed bright enough to glow against navy.

const LOW: [number, number, number] = [15, 29, 50]; // #0f1d32 navy-light
const HIGH: [number, number, number] = [255, 196, 94]; // #ffc45e bright amber

export function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // Ease slightly so mid values stay warm rather than muddy.
  const eased = Math.pow(clamped, 0.75);
  const rgb = LOW.map((lo, i) => Math.round(lo + (HIGH[i] - lo) * eased));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

// Readable text colour for a given heat level.
export function heatTextColor(t: number): string {
  return t > 0.55 ? '#0a1628' : 'rgba(255,255,255,0.85)';
}
