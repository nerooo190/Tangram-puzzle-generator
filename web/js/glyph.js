// Beliebige Zeichen (Emoji, Buchstaben, Wörter) im Browser zu einer Silhouetten-Maske rastern.
import { maskFromBitmap } from './core/mask.js';

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const PURE_EMOJI_RE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Emoji_Component}|‍|️|\s)+$/u;

export function isEmoji(s) { return EMOJI_RE.test(s); }

/** Zerlegt Eingabe in einzelne Formen: Zeilen/Kommas, reine Emoji-Ketten werden in Einzelzeichen getrennt. */
export function splitGlyphs(text) {
  const out = [];
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('de', { granularity: 'grapheme' }) : null;
  for (const raw of String(text).split(/[\n,;]+/)) {
    const t = raw.trim();
    if (!t) continue;
    if (PURE_EMOJI_RE.test(t) && seg) {
      for (const { segment } of seg.segment(t)) if (segment.trim()) out.push(segment);
    } else out.push(t);
  }
  return [...new Set(out)];
}

export function glyphToMask(glyph) {
  const emoji = isEmoji(glyph);
  let W = 320; const H = 320;
  const probe = document.createElement('canvas').getContext('2d');
  let font;
  if (emoji) font = '230px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
  else {
    font = 'bold 250px "DejaVu Sans","Helvetica Neue",Arial,sans-serif';
    probe.font = font;
    W = Math.max(320, Math.ceil(probe.measureText(glyph).width) + 80);
  }
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.font = font;
  if (emoji) { ctx.textAlign = 'left'; ctx.fillText(glyph, 40, 245); }
  else { ctx.textAlign = 'center'; ctx.fillText(glyph, W / 2, 245); }
  const d = ctx.getImageData(0, 0, W, H).data;
  const bin = new Uint8Array(W * H);
  for (let i = 0; i < bin.length; i++) bin[i] = d[i * 4 + 3] > 24 ? 1 : 0;
  return maskFromBitmap(bin, W, H);
}
