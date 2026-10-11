class_name TangramGeom
extends RefCounted
## Tangram-Geometrie: Teile, Platzierungen, Kollision, Andocken (Port von web/js/core/geom.js).
##
## Koordinaten: y zeigt nach unten. Eine Platzierung ist ein Array [typ, rot, flip, tx, ty]:
##   Eckpunkt = Rot(rot*45°) * Flip^flip * lokaler Punkt + (tx, ty)
## Punkte sind Arrays [x, y] aus 64-Bit-Floats (Vector2 wäre nur 32 Bit genau).

const SQ2 := 1.4142135623730951
const H := 0.7071067811865476

const T_SMALL := 0
const T_MEDIUM := 1
const T_LARGE := 2
const T_SQUARE := 3
const T_PARA := 4

const TYPE_NAMES := ["Kleines Dreieck", "Mittleres Dreieck", "Großes Dreieck", "Quadrat", "Parallelogramm"]
const TYPE_AREA := [0.5, 1.0, 2.0, 1.0, 1.0]
const TYPE_CHIRAL := [false, false, false, false, true]
const KIT_ORDER := [2, 2, 1, 3, 4, 0, 0]
const SET_AREA := 8.0
const EPS := 1e-7

const COS_T := [1.0, H, 0.0, -H, -1.0, -H, 0.0, H]
const SIN_T := [0.0, H, 1.0, H, 0.0, -H, -1.0, -H]

static var _orient: Array = []   # [typ][flip] = { "v": [[x,y]..], "oct": [int], "len": [float] }


static func _local_verts(t: int) -> Array:
	match t:
		0: return [[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]]
		1: return [[0.0, 0.0], [SQ2, 0.0], [0.0, SQ2]]
		2: return [[0.0, 0.0], [2.0, 0.0], [0.0, 2.0]]
		3: return [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]]
		_: return [[0.0, 0.0], [SQ2, 0.0], [SQ2 + H, H], [H, H]]


static func orient(t: int, flip: int) -> Dictionary:
	if _orient.is_empty():
		for ty in 5:
			var per_flip := []
			for fl in 2:
				var v: Array = []
				for p in _local_verts(ty):
					v.append([p[0], p[1]])
				if fl == 1:
					var m: Array = []
					for p in v:
						m.append([-p[0], p[1]])
					m.reverse()
					v = m
				var n := v.size()
				var oct := []
				var ln := []
				for j in n:
					var dx: float = v[(j + 1) % n][0] - v[j][0]
					var dy: float = v[(j + 1) % n][1] - v[j][1]
					oct.append(posmod(int(roundf(atan2(dy, dx) / (PI / 4.0))), 8))
					ln.append(sqrt(dx * dx + dy * dy))
				per_flip.append({"v": v, "oct": oct, "len": ln})
			_orient.append(per_flip)
	return _orient[t][flip]


static func kit_types(sets: int) -> Array:
	var out := []
	for s in sets:
		for t in KIT_ORDER:
			out.append(t)
	return out


static func rot_pt(rot: int, x: float, y: float) -> Array:
	return [x * COS_T[rot] - y * SIN_T[rot], x * SIN_T[rot] + y * COS_T[rot]]


static func placement_verts(pl: Array) -> Array:
	var o := orient(int(pl[0]), int(pl[2]))
	var rot := int(pl[1])
	var tx: float = pl[3]
	var ty: float = pl[4]
	var c: float = COS_T[rot]
	var s: float = SIN_T[rot]
	var out := []
	for p in o["v"]:
		var x: float = p[0]
		var y: float = p[1]
		out.append([x * c - y * s + tx, x * s + y * c + ty])
	return out


static func poly_area(v: Array) -> float:
	var a := 0.0
	for i in v.size():
		var p: Array = v[i]
		var q: Array = v[(i + 1) % v.size()]
		a += p[0] * q[1] - q[0] * p[1]
	return a / 2.0


static func poly_centroid(v: Array) -> Array:
	var a := 0.0
	var cx := 0.0
	var cy := 0.0
	for i in v.size():
		var p: Array = v[i]
		var q: Array = v[(i + 1) % v.size()]
		var cr: float = p[0] * q[1] - q[0] * p[1]
		a += cr
		cx += (p[0] + q[0]) * cr
		cy += (p[1] + q[1]) * cr
	return [cx / (3.0 * a), cy / (3.0 * a)]


## true, wenn sich zwei konvexe Polygone mit positiver Fläche überlappen.
static func overlaps(A: Array, B: Array, eps: float = EPS) -> bool:
	for pass_i in 2:
		var P: Array = A if pass_i == 0 else B
		var Q: Array = B if pass_i == 0 else A
		var n := P.size()
		for i in n:
			var p: Array = P[i]
			var r: Array = P[(i + 1) % n]
			var ex: float = r[0] - p[0]
			var ey: float = r[1] - p[1]
			var l := sqrt(ex * ex + ey * ey)
			var nx := ey / l
			var ny := -ex / l
			var separated := true
			for k in Q.size():
				if nx * (Q[k][0] - p[0]) + ny * (Q[k][1] - p[1]) < -eps:
					separated = false
					break
			if separated:
				return false
	return true


static func bbox(polys: Array) -> Array:
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
	return [x0, y0, x1, y1]


## Länge, auf der zwei Polygone mit Kanten aneinanderliegen.
static func contact_length(A: Array, B: Array, eps: float = 1e-6) -> float:
	var total := 0.0
	for i in A.size():
		var p: Array = A[i]
		var q: Array = A[(i + 1) % A.size()]
		var dx: float = q[0] - p[0]
		var dy: float = q[1] - p[1]
		var L := sqrt(dx * dx + dy * dy)
		var ux := dx / L
		var uy := dy / L
		for k in B.size():
			var r: Array = B[k]
			var s: Array = B[(k + 1) % B.size()]
			var c1: float = ux * (r[1] - p[1]) - uy * (r[0] - p[0])
			var c2: float = ux * (s[1] - p[1]) - uy * (s[0] - p[0])
			if absf(c1) > eps or absf(c2) > eps:
				continue
			var a: float = ux * (r[0] - p[0]) + uy * (r[1] - p[1])
			var b: float = ux * (s[0] - p[0]) + uy * (s[1] - p[1])
			var lo := maxf(0.0, minf(a, b))
			var hi := minf(L, maxf(a, b))
			if hi - lo > eps:
				total += hi - lo
	return total


## placed: [{ "pl": Array, "v": Array }]. Liefert { "pl", "v", "parent" } oder {} (leer).
static func sample_attach(placed: Array, type: int, rng: TangramRng, tries: int = 60) -> Dictionary:
	var chiral: bool = TYPE_CHIRAL[type]
	for k in tries:
		var qi := rng.int_(placed.size())
		var q: Dictionary = placed[qi]
		var qpl: Array = q["pl"]
		var qv: Array = q["v"]
		var qo := orient(int(qpl[0]), int(qpl[2]))
		var e := rng.int_(qv.size())
		var oq: int = (int(qo["oct"][e]) + int(qpl[1])) & 7
		var L: float = qo["len"][e]
		var flip := rng.int_(2) if chiral else 0
		var O := orient(type, flip)
		var j := rng.int_(O["v"].size())
		var rot := posmod(oq + 4 - int(O["oct"][j]), 8)
		var M: float = O["len"][j]
		var mode := rng.int_(3)
		var u0 := 0.0
		if mode == 1:
			u0 = L - M
		elif mode == 2:
			u0 = (L - M) / 2.0
		var dx: float = COS_T[oq]
		var dy: float = SIN_T[oq]
		var ax: float = qv[e][0] + (u0 + M) * dx
		var ay: float = qv[e][1] + (u0 + M) * dy
		var rv := rot_pt(rot, O["v"][j][0], O["v"][j][1])
		var pl := [type, rot, flip, ax - rv[0], ay - rv[1]]
		var v := placement_verts(pl)
		var ok := true
		for i in placed.size():
			if overlaps(v, placed[i]["v"]):
				ok = false
				break
		if ok:
			return {"pl": pl, "v": v, "parent": qi}
	return {}


# ---- Gruppenelemente (Drehung/Spiegelung): Rot(k*45°) * Mx^m -----------------------

static func linear_map(k: int, m: int, x: float, y: float) -> Array:
	return rot_pt(k, -x if m != 0 else x, y)


static func map_placement(pl: Array, k: int, m: int, ux: float, uy: float) -> Array:
	var rot := posmod(k + (-int(pl[1]) if m != 0 else int(pl[1])), 8)
	var flip := m ^ int(pl[2])
	var t := linear_map(k, m, pl[3], pl[4])
	return [int(pl[0]), rot, flip, t[0] + ux, t[1] + uy]


static func g_mul(ra: int, fa: int, rb: int, fb: int) -> Array:
	return [posmod(ra + (-rb if fa != 0 else rb), 8), fa ^ fb]


static func g_inv(r: int, f: int) -> Array:
	return [r, 1] if f != 0 else [posmod(8 - r, 8), 0]


static func round6(x: float) -> float:
	return floor(x * 1e6 + 0.5) / 1e6


## Zentriert die Bounding-Box und rundet die Verschiebungen.
static func center_and_round(pls: Array) -> Array:
	var polys := []
	for p in pls:
		polys.append(placement_verts(p))
	var bb := bbox(polys)
	var cx: float = (bb[0] + bb[2]) / 2.0
	var cy: float = (bb[1] + bb[3]) / 2.0
	var out := []
	for p in pls:
		out.append([int(p[0]), int(p[1]), int(p[2]), round6(p[3] - cx), round6(p[4] - cy)])
	return out


static func hull_area(polys: Array) -> float:
	var pts := []
	for v in polys:
		for p in v:
			pts.append(p)
	pts.sort_custom(func(a, b): return a[0] < b[0] or (a[0] == b[0] and a[1] < b[1]))
	var lower := []
	for p in pts:
		while lower.size() >= 2 and _cross(lower[lower.size() - 2], lower[lower.size() - 1], p) <= 1e-12:
			lower.pop_back()
		lower.append(p)
	var upper := []
	var i := pts.size() - 1
	while i >= 0:
		var p = pts[i]
		while upper.size() >= 2 and _cross(upper[upper.size() - 2], upper[upper.size() - 1], p) <= 1e-12:
			upper.pop_back()
		upper.append(p)
		i -= 1
	lower.pop_back()
	upper.pop_back()
	return absf(poly_area(lower + upper))


static func _cross(o: Array, a: Array, b: Array) -> float:
	return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
