class_name TangramFit
extends RefCounted
## Solver: legt einen Satz Tangram-Teile (Simulated Annealing) so, dass die Silhouette einer Zielmaske
## möglichst gut getroffen wird (Maß: IoU). Port von web/js/core/fit.js.
##
## Maske: { "w": int, "h": int, "c": float, "bits": PackedByteArray (0/1, w*h) }  (siehe mask_from_json)
## Rechenintensiv: in einem Thread aufrufen (TangramLibrary erledigt das).

const G = preload("tangram_geom.gd")

var _w: int
var _h: int
var _cw: float
var _P: PackedInt32Array
var _ones: int
var _tcx: float
var _tcy: float
var _total_cells: float
var _qx := PackedFloat64Array()
var _qy := PackedFloat64Array()


static func mask_from_json(j: Dictionary) -> Dictionary:
	var w := int(j["w"])
	var h := int(j["h"])
	var raw := Marshalls.base64_to_raw(str(j["bits"]))
	var bits := PackedByteArray()
	bits.resize(w * h)
	for i in w * h:
		bits[i] = (raw[i >> 3] >> (i & 7)) & 1
	return {"w": w, "h": h, "c": float(j["c"]), "bits": bits}


func _prepare(mask: Dictionary, sets: int) -> void:
	_w = mask["w"]
	_h = mask["h"]
	var c: float = mask["c"]
	var bits: PackedByteArray = mask["bits"]
	_P = PackedInt32Array()
	_P.resize(_h * (_w + 1))
	_ones = 0
	var sx := 0
	var sy := 0
	for j in _h:
		var run := 0
		for i in _w:
			if bits[j * _w + i] != 0:
				run += 1
				_ones += 1
				sx += i
				sy += j
			_P[j * (_w + 1) + i + 1] = run
	_cw = c * sqrt(float(sets))
	_tcx = float(sx) / float(_ones)
	_tcy = float(sy) / float(_ones)
	_total_cells = (8.0 * sets) / (_cw * _cw)
	_qx.resize(8)
	_qy.resize(8)


## IoU der Polygone (Assembly-Koordinaten) nach Drehung g und Zentroid-Ausrichtung (+Verschiebung in Zellen).
func _eval_iou(polys: Array, g: int, sx: float, sy: float, cA: Array) -> float:
	var cs: float = G.COS_T[g]
	var sn: float = G.SIN_T[g]
	var inv := 1.0 / _cw
	var ox := _tcx + sx + 0.01371
	var oy := _tcy + sy + 0.00913
	var inter := 0
	for k in polys.size():
		var v: Array = polys[k]
		var n := v.size()
		var ymin := INF
		var ymax := -INF
		for i in n:
			var x: float = v[i][0] - cA[0]
			var y: float = v[i][1] - cA[1]
			var qx := (x * cs - y * sn) * inv + ox
			var qy := (x * sn + y * cs) * inv + oy
			_qx[i] = qx
			_qy[i] = qy
			if qy < ymin: ymin = qy
			if qy > ymax: ymax = qy
		var j0 := int(ceil(ymin))
		var j1 := int(ceil(ymax)) - 1
		if j0 < 0: j0 = 0
		if j1 > _h - 1: j1 = _h - 1
		for j in range(j0, j1 + 1):
			var xl := INF
			var xr := -INF
			for e in n:
				var e2 := 0 if e + 1 == n else e + 1
				var py := _qy[e]
				var qy2 := _qy[e2]
				if (py <= j and qy2 > j) or (qy2 <= j and py > j):
					var x := _qx[e] + ((j - py) * (_qx[e2] - _qx[e])) / (qy2 - py)
					if x < xl: xl = x
					if x > xr: xr = x
			if xl > xr:
				continue
			var i0 := int(ceil(xl))
			var i1 := int(ceil(xr)) - 1
			if i0 < 0: i0 = 0
			if i1 > _w - 1: i1 = _w - 1
			if i1 >= i0:
				inter += _P[j * (_w + 1) + i1 + 1] - _P[j * (_w + 1) + i0]
	return float(inter) / (float(_ones) + _total_cells - float(inter))


## exp(x) für x <= 0 nur mit Grundrechenarten (bit-genau wie in JS).
static func exp_neg(x: float) -> float:
	if x < -30.0:
		return 0.0
	var y := x / 64.0
	var t := 1.0 + y * (1.0 + y * (1.0 / 2.0 + y * (1.0 / 6.0 + y * (1.0 / 24.0 + y * (1.0 / 120.0 + y * (1.0 / 720.0))))))
	for i in 6:
		t *= t
	return t


static func _pow_int(x: float, m: int) -> float:
	var r := 1.0
	var b := x
	while m > 0:
		if (m & 1) != 0:
			r *= b
		b *= b
		m >>= 1
	return r


## r mit r^m = t1/t0 (nur Multiplikationen/Vergleiche -> identisch zur JS-Version).
static func geo_ratio(t0: float, t1: float, m: int) -> float:
	var target := t1 / t0
	var lo := 0.0
	var hi := 1.0
	for i in 60:
		var mid := (lo + hi) / 2.0
		if _pow_int(mid, m) > target:
			hi = mid
		else:
			lo = mid
	return (lo + hi) / 2.0


static func _centroid_of(polys: Array) -> Array:
	var A := 0.0
	var cx := 0.0
	var cy := 0.0
	for v in polys:
		var a := G.poly_area(v)
		var c := G.poly_centroid(v)
		A += a
		cx += a * c[0]
		cy += a * c[1]
	return [cx / A, cy / A]


static func _build_initial(rng: TangramRng, types: Array) -> Dictionary:
	while true:
		var pls := []
		var vs := []
		var parent := [-1]
		var first := [int(types[0]), rng.int_(8), rng.int_(2) if G.TYPE_CHIRAL[int(types[0])] else 0, 0.0, 0.0]
		pls.append(first)
		vs.append(G.placement_verts(first))
		var ok := true
		for i in range(1, types.size()):
			var placed := []
			for k in pls.size():
				placed.append({"pl": pls[k], "v": vs[k]})
			var c := G.sample_attach(placed, int(types[i]), rng, 60)
			if c.is_empty():
				ok = false
				break
			pls.append(c["pl"])
			vs.append(c["v"])
			parent.append(c["parent"])
		if ok:
			return {"pls": pls, "vs": vs, "parent": parent}
	return {}


static func _descendants(parent: Array, i: int) -> Array:
	var in_d := []
	in_d.resize(parent.size())
	in_d.fill(false)
	in_d[i] = true
	var changed := true
	while changed:
		changed = false
		for k in parent.size():
			if not in_d[k] and int(parent[k]) >= 0 and in_d[int(parent[k])]:
				in_d[k] = true
				changed = true
	return in_d


## Schneidet einen Teilbaum ab und hängt ihn starr woanders an. Liefert neuen Zustand oder {}.
static func _graft(S: Dictionary, types: Array, rng: TangramRng) -> Dictionary:
	var n: int = S["pls"].size()
	var i := 1 + rng.int_(n - 1)
	var in_d := _descendants(S["parent"], i)
	var rest := []
	for k in n:
		if not in_d[k]:
			rest.append(k)
	var placed := []
	for k in rest:
		placed.append({"pl": S["pls"][k], "v": S["vs"][k]})
	var c := G.sample_attach(placed, int(types[i]), rng, 25)
	if c.is_empty():
		return {}
	var old: Array = S["pls"][i]
	var inv := G.g_inv(int(old[1]), int(old[2]))
	var cpl: Array = c["pl"]
	var L := G.g_mul(int(cpl[1]), int(cpl[2]), inv[0], inv[1])
	var lt := G.linear_map(L[0], L[1], old[3], old[4])
	var ux: float = cpl[3] - lt[0]
	var uy: float = cpl[4] - lt[1]
	var pls: Array = S["pls"].duplicate()
	var vs: Array = S["vs"].duplicate()
	var parent: Array = S["parent"].duplicate()
	for k in n:
		if not in_d[k]:
			continue
		if k == i:
			pls[k] = cpl
			vs[k] = c["v"]
		else:
			pls[k] = G.map_placement(S["pls"][k], L[0], L[1], ux, uy)
			vs[k] = G.placement_verts(pls[k])
	parent[i] = rest[int(c["parent"])]
	for k in n:
		if not in_d[k] or k == i:
			continue
		for r in rest.size():
			if G.overlaps(vs[k], vs[rest[r]]):
				return {}
	return {"pls": pls, "vs": vs, "parent": parent}


static func _mirror_all(S: Dictionary) -> Dictionary:
	var pls := []
	var vs := []
	for p in S["pls"]:
		var q := G.map_placement(p, 0, 1, 0.0, 0.0)
		pls.append(q)
		vs.append(G.placement_verts(q))
	return {"pls": pls, "vs": vs, "parent": S["parent"]}


static func _key(pls: Array) -> String:
	var parts := []
	for p in pls:
		var vv := []
		for q in G.placement_verts(p):
			vv.append("%d,%d" % [int(floor(q[0] * 1000.0 + 0.5)), int(floor(q[1] * 1000.0 + 0.5))])
		vv.sort()
		parts.append("%d:%s" % [int(p[0]), ";".join(vv)])
	parts.sort()
	return "|".join(parts)


func _anneal(types: Array, rng: TangramRng, iters: int, t0: float, t1: float) -> Dictionary:
	var S := _build_initial(rng, types)
	var g := rng.int_(8)
	var cA := _centroid_of(S["vs"])
	var cur := _eval_iou(S["vs"], g, 0.0, 0.0, cA)
	var best := {"S": S, "g": g, "iou": cur}
	var ratio := geo_ratio(t0, t1, maxi(1, iters - 1))
	var temp := t0
	for it in iters:
		var cur_temp := temp
		temp *= ratio
		var r := rng.randf_()
		var S2: Dictionary = S
		var g2 := g
		var same := true
		if r < 0.08:
			g2 = (g + 1 + rng.int_(7)) & 7
		elif r < 0.10:
			S2 = _mirror_all(S)
			same = false
		else:
			S2 = _graft(S, types, rng)
			if S2.is_empty():
				continue
			same = false
		var cA2: Array = cA if same else _centroid_of(S2["vs"])
		var val := _eval_iou(S2["vs"], g2, 0.0, 0.0, cA2)
		var d := val - cur
		if d >= 0.0 or rng.randf_() < exp_neg(d / cur_temp):
			S = S2
			g = g2
			cA = cA2
			cur = val
			if cur > float(best["iou"]):
				best = {"S": S, "g": g, "iou": cur}
	return best


## Feinjustierung der Verschiebung (in Zellen).
func _polish(S: Dictionary, g: int) -> Dictionary:
	var cA := _centroid_of(S["vs"])
	var bx := 0.0
	var by := 0.0
	var bv := _eval_iou(S["vs"], g, 0.0, 0.0, cA)
	for step in [2.0, 1.0, 0.5, 0.25]:
		var moved := true
		while moved:
			moved = false
			for dd in [[step, 0.0], [-step, 0.0], [0.0, step], [0.0, -step], [step, step], [-step, -step], [step, -step], [-step, step]]:
				var v := _eval_iou(S["vs"], g, bx + dd[0], by + dd[1], cA)
				if v > bv + 1e-12:
					bv = v
					bx += dd[0]
					by += dd[1]
					moved = true
	return {"sx": bx, "sy": by, "iou": bv, "cA": cA}


func _to_frame(S: Dictionary, g: int, sx: float, sy: float, cA: Array) -> Array:
	var r := G.rot_pt(g, cA[0], cA[1])
	var ux: float = (_tcx + sx + 0.5 - _w / 2.0) * _cw - float(r[0])
	var uy: float = (_tcy + sy + 0.5 - _h / 2.0) * _cw - float(r[1])
	var out := []
	for p in S["pls"]:
		var q := G.map_placement(p, g, 0, ux, uy)
		out.append([int(q[0]), int(q[1]), int(q[2]), G.round6(q[3]), G.round6(q[4])])
	return out


## opts: { "sets": 1, "seed": "fit", "restarts": 8, "iters": 12000, "topK": 8 }
## Liefert [{ "iou": float, "pls": Array }] sortiert nach IoU, ohne Duplikate.
static func solve(mask: Dictionary, opts: Dictionary = {}) -> Array:
	var self_ := TangramFit.new()
	return self_._solve(mask, opts)


func _solve(mask: Dictionary, opts: Dictionary) -> Array:
	var sets: int = int(opts.get("sets", 1))
	var seed_text: String = str(opts.get("seed", "fit"))
	var restarts: int = int(opts.get("restarts", 8))
	var iters: int = int(opts.get("iters", 12000))
	var top_k: int = int(opts.get("topK", 8))
	_prepare(mask, sets)
	var types := G.kit_types(sets)
	var rng := TangramRng.new(seed_text)
	var results := []
	for r in restarts:
		var best := _anneal(types, rng, iters, 0.05, 0.003)
		var pol := _polish(best["S"], int(best["g"]))
		var pls := _to_frame(best["S"], int(best["g"]), pol["sx"], pol["sy"], pol["cA"])
		results.append({"iou": pol["iou"], "pls": pls})
	# stabile Sortierung (absteigend nach IoU) – wie Array.sort in JS
	for i in range(1, results.size()):
		var item = results[i]
		var j := i - 1
		while j >= 0 and float(results[j]["iou"]) < float(item["iou"]):
			results[j + 1] = results[j]
			j -= 1
		results[j + 1] = item
	var seen := {}
	var out := []
	for r in results:
		var k := _key(r["pls"])
		if seen.has(k):
			continue
		seen[k] = true
		out.append({"iou": floor(float(r["iou"]) * 10000.0 + 0.5) / 10000.0, "pls": r["pls"]})
		if out.size() >= top_k:
			break
	return out
