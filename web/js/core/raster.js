// Scanline-Rasterung konvexer Polygone auf ein Zellgitter (Zellmitte zählt, halboffen).

/** Trägt die Zellen eines Polygons in grid (Uint8Array W*Hh) ein. Zelle (i,j): Mitte (x0+(i+.5)c, y0+(j+.5)c). */
export function fillPoly(grid, v, x0, y0, c, W, Hh) {
  let ymin = Infinity, ymax = -Infinity;
  for (const p of v) { if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1]; }
  let j0 = Math.ceil((ymin - y0) / c - 0.5), j1 = Math.ceil((ymax - y0) / c - 0.5) - 1;
  if (j0 < 0) j0 = 0; if (j1 > Hh - 1) j1 = Hh - 1;
  const n = v.length;
  for (let j = j0; j <= j1; j++) {
    const y = y0 + (j + 0.5) * c;
    let xl = Infinity, xr = -Infinity;
    for (let e = 0; e < n; e++) {
      const p = v[e], q = v[(e + 1) % n];
      if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) {
        const x = p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]);
        if (x < xl) xl = x; if (x > xr) xr = x;
      }
    }
    if (xl > xr) continue;
    let i0 = Math.ceil((xl - x0) / c - 0.5), i1 = Math.ceil((xr - x0) / c - 0.5) - 1;
    if (i0 < 0) i0 = 0; if (i1 > W - 1) i1 = W - 1;
    for (let i = i0; i <= i1; i++) grid[j * W + i] = 1;
  }
}

/** Gibt true zurück, wenn die Vereinigung der Polygone eingeschlossene Löcher hat. */
export function hasHole(polys, c = 0.1) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const v of polys) for (const p of v) {
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
  }
  x0 -= 2 * c; y0 -= 2 * c; x1 += 2 * c; y1 += 2 * c;
  const W = Math.ceil((x1 - x0) / c), Hh = Math.ceil((y1 - y0) / c);
  const g = new Uint8Array(W * Hh);
  for (const v of polys) fillPoly(g, v, x0, y0, c, W, Hh);
  // Flood-Fill des Außenbereichs
  const seen = new Uint8Array(W * Hh);
  const stack = [0];
  seen[0] = 1;
  let reached = 1, filled = 0;
  for (let k = 0; k < g.length; k++) filled += g[k];
  while (stack.length) {
    const k = stack.pop();
    const i = k % W, j = (k - i) / W;
    if (i > 0 && !g[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; reached++; stack.push(k - 1); }
    if (i < W - 1 && !g[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; reached++; stack.push(k + 1); }
    if (j > 0 && !g[k - W] && !seen[k - W]) { seen[k - W] = 1; reached++; stack.push(k - W); }
    if (j < Hh - 1 && !g[k + W] && !seen[k + W]) { seen[k + W] = 1; reached++; stack.push(k + W); }
  }
  return reached + filled < W * Hh;
}
