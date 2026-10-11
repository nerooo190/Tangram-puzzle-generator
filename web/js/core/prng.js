// Deterministischer Zufallsgenerator (cyrb128-Seed + sfc32).
// Reine 32-Bit-Ganzzahlarithmetik, damit die GDScript-Version exakt dieselben Werte liefert.

export function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export class Rng {
  constructor(seed) {
    const s = cyrb128(String(seed));
    this.a = s[0]; this.b = s[1]; this.c = s[2]; this.d = s[3];
    for (let i = 0; i < 15; i++) this.nextU32();
  }
  nextU32() {
    const t0 = (this.a + this.b) >>> 0;
    this.a = (this.b ^ (this.b >>> 9)) >>> 0;
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.d = (this.d + 1) >>> 0;
    const t = (t0 + this.d) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t;
  }
  /** Gleitkommazahl in [0,1) */
  float() { return this.nextU32() / 4294967296; }
  /** Ganzzahl in [0,n) */
  int(n) { return Math.floor((this.nextU32() * n) / 4294967296); }
  pick(arr) { return arr[this.int(arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
}
