import type { Chroma } from "./chroma.ts";
import { CHORD_TEMPLATES } from "./chordTemplates.ts";
import type { ChordTemplate } from "./chordTemplates.ts";

export type ChordCandidate = {
  template: ChordTemplate;
  score: number; // 0 … 1, how similar the chroma is to this chord's template
};

/** Cosine similarity between a chroma and a 0/1 template (independent of loudness). */
export function similarity(chroma: Chroma, template: ChordTemplate): number {
  let agreement = 0;
  for (const tone of template.tones) agreement += chroma[tone];

  const chromaLength = Math.hypot(...chroma);
  const templateLength = Math.sqrt(template.tones.length);
  if (chromaLength === 0) return 0;
  return agreement / (chromaLength * templateLength);
}

export function rankChords(chroma: Chroma): ChordCandidate[] {
  return CHORD_TEMPLATES.map((template) => ({
    template,
    score: similarity(chroma, template),
  })).sort((a, b) => b.score - a.score);
}
