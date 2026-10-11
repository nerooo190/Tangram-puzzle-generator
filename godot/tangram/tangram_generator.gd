class_name TangramGenerator
extends RefCounted
## Prozeduraler Generator: beliebig viele abstrakte Figuren und Muster aus einer Seed-Zeichenkette.
## Port von web/js/core/generate.js – gleicher Seed ergibt dieselbe Figur wie im Web.

const G = preload("tangram_geom.gd")

const STYLE_IDS := ["frei", "kompakt", "lang", "verzweigt"]
const STYLE_NAMES := {"frei": "Zufall", "kompakt": "Kompakt", "lang": "Lang & schlank", "verzweigt": "Verzweigt"}
const PATTERN_IDS := ["spiegel", "vier", "punkt"]
const PATTERN_NAMES := {"spiegel": "Spiegel-Muster", "vier": "Kaleidoskop", "punkt": "Punktsymmetrie"}


static func _style(style: String) -> Dictionary:
	match style:
		"kompakt": return {"shuffle": false, "k": 10, "mode": "compact"}
		"lang": return {"shuffle": true, "k": 10, "mode": "long"}
		"verzweigt": return {"shuffle": true, "k": 10, "mode": "spiky"}
		_: return {"shuffle": true, "k": 1, "mode": ""}


static func _score(mode: String, polys: Array) -> float:
	var area := 0.0
	for v in polys:
		area += G.poly_area(v)
	var hull := G.hull_area(polys)
	if mode == "compact":
		return area / hull
	if mode == "spiky":
		return -area / hull
	var bb := G.bbox(polys)
	var w: float = bb[2] - bb[0]
	var h: float = bb[3] - bb[1]
	return maxf(w, h) / sqrt(area)


## Baut einmal eine zusammenhängende Anordnung. Liefert Platzierungen oder [] bei Misserfolg.
static func _build_once(rng: TangramRng, types: Array, style: String) -> Array:
	var st := _style(style)
	var order := types.duplicate()
	if st["shuffle"]:
		rng.shuffle_(order)
	var first := [int(order[0]), rng.int_(8), 0, 0.0, 0.0]
	if G.TYPE_CHIRAL[int(order[0])]:
		first[2] = rng.int_(2)
	var placed := [{"pl": first, "v": G.placement_verts(first)}]
	for i in range(1, order.size()):
		var best := {}
		var best_score := -INF
		for k in int(st["k"]):
			var c := G.sample_attach(placed, int(order[i]), rng, 60)
			if c.is_empty():
				continue
			if int(st["k"]) == 1:
				best = c
				break
			var vs := []
			for p in placed:
				vs.append(p["v"])
			vs.append(c["v"])
			var s := _score(st["mode"], vs)
			if s > best_score:
				best_score = s
				best = c
		if best.is_empty():
			return []
		placed.append({"pl": best["pl"], "v": best["v"]})
	var out := []
	for p in placed:
		out.append(p["pl"])
	return out


static func _verts_of(pls: Array) -> Array:
	var out := []
	for p in pls:
		out.append(G.placement_verts(p))
	return out


## Abstrakte Figur. Liefert Platzierungen [[typ,rot,flip,x,y],...] oder [].
static func generate_abstract(seed_text: String, style: String = "frei", sets: int = 1) -> Array:
	var rng := TangramRng.new(seed_text)
	var types := G.kit_types(sets)
	for attempt in 200:
		var pls := _build_once(rng, types, style)
		if pls.is_empty():
			continue
		if TangramRaster.has_hole(_verts_of(pls)):
			continue
		return G.center_and_round(pls)
	return []


static func _connected(polys: Array) -> bool:
	var n := polys.size()
	var seen := []
	seen.resize(n)
	seen.fill(false)
	var st := [0]
	seen[0] = true
	var cnt := 1
	while not st.is_empty():
		var i: int = st.pop_back()
		for j in n:
			if not seen[j] and G.contact_length(polys[i], polys[j]) > 1e-6:
				seen[j] = true
				cnt += 1
				st.append(j)
	return cnt == n


static func _map_all(pls: Array, k: int, m: int, ux: float, uy: float) -> Array:
	var out := []
	for p in pls:
		out.append(G.map_placement(p, k, m, ux, uy))
	return out


## Muster: "spiegel" (14 Teile), "vier" (28 Teile), "punkt" (14 Teile).
static func generate_pattern(seed_text: String, kind: String = "spiegel") -> Array:
	var rng := TangramRng.new(seed_text)
	var types := G.kit_types(1)
	var style_names := ["frei", "kompakt", "lang"]
	for attempt in 300:
		var base := _build_once(rng, types, style_names[rng.int_(3)])
		if base.is_empty():
			continue
		var all := []
		if kind == "spiegel" or kind == "vier":
			var bb := G.bbox(_verts_of(base))
			var cur := base + _map_all(base, 0, 1, 2.0 * bb[2], 0.0)
			if kind == "vier":
				var bb2 := G.bbox(_verts_of(cur))
				cur = cur + _map_all(cur, 4, 1, 0.0, 2.0 * bb2[3])
			all = cur
		else:
			var polys := _verts_of(base)
			var cands := []
			for i in polys.size():
				var v: Array = polys[i]
				for e in v.size():
					var p: Array = v[e]
					var q: Array = v[(e + 1) % v.size()]
					var free := true
					for j in polys.size():
						if j == i:
							continue
						if G.contact_length([p, q, [q[0] + 1e-9, q[1] + 1e-9]], polys[j]) > 1e-6:
							free = false
							break
					if free:
						cands.append([(p[0] + q[0]) / 2.0, (p[1] + q[1]) / 2.0])
			rng.shuffle_(cands)
			for m in cands:
				var rotated := _map_all(base, 4, 0, 2.0 * m[0], 2.0 * m[1])
				var rp := _verts_of(rotated)
				var ok := true
				for a in rp.size():
					if not ok:
						break
					for b in polys.size():
						if G.overlaps(rp[a], polys[b]):
							ok = false
							break
				if ok:
					all = base + rotated
					break
			if all.is_empty():
				continue
		var pv := _verts_of(all)
		var ok2 := true
		for a in pv.size():
			if not ok2:
				break
			for b in range(a + 1, pv.size()):
				if G.overlaps(pv[a], pv[b]):
					ok2 = false
					break
		if not ok2 or not _connected(pv) or TangramRaster.has_hole(pv):
			continue
		return G.center_and_round(all)
	return []
