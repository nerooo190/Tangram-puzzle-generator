class_name TangramRaster
extends RefCounted
## Scanline-Rasterung konvexer Polygone (Port von web/js/core/raster.js).


static func fill_poly(grid: PackedByteArray, v: Array, x0: float, y0: float, c: float, W: int, Hh: int) -> void:
	var ymin := INF
	var ymax := -INF
	for p in v:
		if p[1] < ymin: ymin = p[1]
		if p[1] > ymax: ymax = p[1]
	var j0 := int(ceil((ymin - y0) / c - 0.5))
	var j1 := int(ceil((ymax - y0) / c - 0.5)) - 1
	if j0 < 0: j0 = 0
	if j1 > Hh - 1: j1 = Hh - 1
	var n := v.size()
	for j in range(j0, j1 + 1):
		var y := y0 + (j + 0.5) * c
		var xl := INF
		var xr := -INF
		for e in n:
			var p: Array = v[e]
			var q: Array = v[(e + 1) % n]
			if (p[1] <= y and q[1] > y) or (q[1] <= y and p[1] > y):
				var x: float = p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1])
				if x < xl: xl = x
				if x > xr: xr = x
		if xl > xr:
			continue
		var i0 := int(ceil((xl - x0) / c - 0.5))
		var i1 := int(ceil((xr - x0) / c - 0.5)) - 1
		if i0 < 0: i0 = 0
		if i1 > W - 1: i1 = W - 1
		for i in range(i0, i1 + 1):
			grid[j * W + i] = 1


## true, wenn die Vereinigung der Polygone eingeschlossene Löcher hat.
static func has_hole(polys: Array, c: float = 0.1) -> bool:
	var x0 := INF
	var y0 := INF
	var x1 := -INF
	var y1 := -INF
	for v in polys:
		for p in v:
			if p[0] < x0: x0 = p[0]
			if p[0] > x1: x1 = p[0]
			if p[1] < y0: y0 = p[1]
			if p[1] > y1: y1 = p[1]
	x0 -= 2.0 * c
	y0 -= 2.0 * c
	x1 += 2.0 * c
	y1 += 2.0 * c
	var W := int(ceil((x1 - x0) / c))
	var Hh := int(ceil((y1 - y0) / c))
	var g := PackedByteArray()
	g.resize(W * Hh)
	for v in polys:
		fill_poly(g, v, x0, y0, c, W, Hh)
	var seen := PackedByteArray()
	seen.resize(W * Hh)
	var stack := [0]
	seen[0] = 1
	var reached := 1
	var filled := 0
	for k in g.size():
		filled += g[k]
	while not stack.is_empty():
		var k: int = stack.pop_back()
		var i := k % W
		var j := (k - i) / W
		if i > 0 and g[k - 1] == 0 and seen[k - 1] == 0:
			seen[k - 1] = 1
			reached += 1
			stack.append(k - 1)
		if i < W - 1 and g[k + 1] == 0 and seen[k + 1] == 0:
			seen[k + 1] = 1
			reached += 1
			stack.append(k + 1)
		if j > 0 and g[k - W] == 0 and seen[k - W] == 0:
			seen[k - W] = 1
			reached += 1
			stack.append(k - W)
		if j < Hh - 1 and g[k + W] == 0 and seen[k + W] == 0:
			seen[k + W] = 1
			reached += 1
			stack.append(k + W)
	return reached + filled < W * Hh
