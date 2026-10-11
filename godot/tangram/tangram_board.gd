class_name TangramBoard
extends Control
## Spielbrett für ein Tangram-Puzzle: Silhouette, Teile ziehen / drehen / spiegeln, Einrasten,
## Tipp, Lösung und Gewinnprüfung. Als Control in jede Szene einbaubar.
##
##   var board := TangramBoard.new()
##   add_child(board)
##   board.puzzle_solved.connect(func(info): print("gelöst in ", info.ms, " ms"))
##   board.load_puzzle(library.peek("tiere", "42"))
##
## Steuerung: Ziehen = Linksklick/Touch, Drehen = Doppelklick / Rechtsklick / Mausrad / R,
## Spiegeln = F, Tipp = H. Rotationen sind immer Vielfache von 45°.

signal puzzle_solved(info: Dictionary)           ## { moves, hints, gave_up, ms }
signal progress_changed(covered: float)          ## 0..1 – wie viel der Silhouette gedeckt ist
signal selection_changed(has_selection: bool)

const G = preload("tangram_geom.gd")

@export var silhouette_color := Color("2b2f55")
@export var background_color := Color(0.93, 0.94, 0.98)
@export var draw_background := true
@export var snap_distance := 0.32
@export var piece_colors: Array[Color] = [
	Color("ef476f"), Color("06b6d4"), Color("ffb703"), Color("8ac926"), Color("6366f1"),
]

var puzzle: Dictionary = {}
var solved := false
var moves := 0
var hints := 0
var gave_up := false

var _sol_pls: Array = []
var _sol_polys: Array = []
var _pieces: Array = []      # [{ "id": int, "type": int, "pl": Array, "verts": Array, "color": Color }]
var _sel := -1               # Index in _pieces
var _drag := {}
var _view := [0.0, 0.0, 1.0, 1.0]   # x, y, w, h in Weltkoordinaten
var _scale := 1.0
var _origin := Vector2.ZERO
var _ghost: Array = []
var _ghost_token := 0
var _start_ms := -1
var _rng := RandomNumberGenerator.new()


func _init() -> void:
	focus_mode = Control.FOCUS_ALL
	clip_contents = true


func _ready() -> void:
	_rng.randomize()
	resized.connect(_update_transform)


# ---------------------------------------------------------------- Öffentliche API

func load_puzzle(pz: Dictionary) -> void:
	puzzle = pz
	solved = false
	gave_up = false
	moves = 0
	hints = 0
	_sel = -1
	_ghost = []
	_start_ms = -1
	_sol_pls = []
	_sol_polys = []
	_pieces = []
	if pz.is_empty():
		queue_redraw()
		return
	for pl in pz["pls"]:
		var q := [int(pl[0]), int(pl[1]), int(pl[2]), float(pl[3]), float(pl[4])]
		_sol_pls.append(q)
		_sol_polys.append(G.placement_verts(q))
	var counts := {}
	for i in _sol_pls.size():
		var t: int = _sol_pls[i][0]
		counts[t] = int(counts.get(t, 0)) + 1
		var c: Color = piece_colors[t]
		var k := (int(counts[t]) - 1) % 3
		c = c.lightened(0.14 * k)
		_pieces.append({"id": i, "type": t, "pl": [t, 0, 0, 0.0, 0.0], "verts": [], "color": c})
	_scatter()
	_fit_view()
	selection_changed.emit(false)
	progress_changed.emit(0.0)
	queue_redraw()


func shuffle() -> void:
	if solved or _pieces.is_empty():
		return
	_scatter()
	_fit_view()
	_select(-1)
	queue_redraw()


func rotate_selected(k: int) -> void:
	if _sel < 0 or solved:
		return
	var p: Dictionary = _pieces[_sel]
	var kk := posmod(k, 8)
	var c := G.poly_centroid(G.placement_verts(p["pl"]))
	var r := G.rot_pt(kk, c[0], c[1])
	p["pl"] = G.map_placement(p["pl"], kk, 0, c[0] - r[0], c[1] - r[1])
	_after_change(p, false)


func flip_selected() -> void:
	if _sel < 0 or solved:
		return
	var p: Dictionary = _pieces[_sel]
	var c := G.poly_centroid(G.placement_verts(p["pl"]))
	p["pl"] = G.map_placement(p["pl"], 0, 1, 2.0 * c[0], 0.0)
	_after_change(p, false)


func nudge_selected(dx: float, dy: float) -> void:
	if _sel < 0 or solved:
		return
	var p: Dictionary = _pieces[_sel]
	var pl: Array = p["pl"]
	p["pl"] = [pl[0], pl[1], pl[2], float(pl[3]) + dx, float(pl[4]) + dy]
	_after_change(p, true)


func has_selection() -> bool:
	return _sel >= 0


func elapsed_ms() -> int:
	return 0 if _start_ms < 0 else Time.get_ticks_msec() - _start_ms


## Zeigt kurz die Zielposition eines noch falsch liegenden Teils. Gibt false zurück, wenn alles passt.
func show_hint() -> bool:
	if solved or _pieces.is_empty():
		return false
	var asg := _assignment()
	var target := -1
	if _sel >= 0:
		for si in asg.size():
			if asg[si] == _sel and not _close(_pieces[_sel]["verts"], _sol_polys[si]):
				target = si
	if target < 0:
		for si in asg.size():
			if asg[si] >= 0 and not _close(_pieces[asg[si]]["verts"], _sol_polys[si]):
				target = si
				break
	if target < 0:
		return false
	hints += 1
	_ghost = [_sol_polys[target], _pieces[asg[target]]["color"]]
	_ghost_token += 1
	var tok := _ghost_token
	queue_redraw()
	get_tree().create_timer(3.5).timeout.connect(func():
		if tok == _ghost_token:
			_ghost = []
			queue_redraw())
	return true


func show_solution() -> void:
	if solved or _pieces.is_empty():
		return
	var asg := _assignment()
	for si in asg.size():
		if asg[si] >= 0:
			var p: Dictionary = _pieces[asg[si]]
			p["pl"] = _sol_pls[si].duplicate()
	gave_up = true
	_refresh_all()
	_check_solved()
	queue_redraw()


## Anteil der Silhouette, der von Teilen gedeckt ist, und Überstand (beides relativ zur Silhouettenfläche).
func coverage() -> Dictionary:
	if _sol_polys.is_empty():
		return {"covered": 0.0, "spill": 0.0}
	var bb := G.bbox(_sol_polys)
	var c := 0.05
	var x0: float = bb[0] - 1.0
	var y0: float = bb[1] - 1.0
	var W := int(ceil((bb[2] - bb[0] + 2.0) / c))
	var Hh := int(ceil((bb[3] - bb[1] + 2.0) / c))
	var sil := PackedByteArray()
	sil.resize(W * Hh)
	var cov := PackedByteArray()
	cov.resize(W * Hh)
	for v in _sol_polys:
		TangramRaster.fill_poly(sil, v, x0, y0, c, W, Hh)
	for p in _pieces:
		TangramRaster.fill_poly(cov, G.placement_verts(p["pl"]), x0, y0, c, W, Hh)
	var s := 0
	var hit := 0
	var spill := 0
	for k in sil.size():
		if sil[k] != 0:
			s += 1
			if cov[k] != 0:
				hit += 1
		elif cov[k] != 0:
			spill += 1
	return {"covered": float(hit) / float(s), "spill": float(spill) / float(s)}


# ---------------------------------------------------------------- Anordnung

func _scatter() -> void:
	var bb := G.bbox(_sol_polys)
	var W: float = bb[2] - bb[0]
	var Hh: float = bb[3] - bb[1]
	var aspect := size.x / size.y if size.x > 0.0 and size.y > 0.0 else 1.4
	var right := aspect > 1.3
	for p in _pieces:
		var t: int = p["type"]
		var rot := _rng.randi_range(0, 7)
		var flip := _rng.randi_range(0, 1) if G.TYPE_CHIRAL[t] else 0
		p["pl"] = [t, rot, flip, 0.0, 0.0]
	var items := []
	for p in _pieces:
		var b := G.bbox([G.placement_verts(p["pl"])])
		items.append({"p": p, "w": b[2] - b[0], "h": b[3] - b[1], "b": b})
	items.sort_custom(func(a, b): return a["h"] > b["h"])
	var gap := 0.35
	var area := 0.0
	for it in items:
		area += (float(it["w"]) + gap) * (float(it["h"]) + gap)
	var row_w: float
	if right:
		row_w = maxf(5.5, sqrt(area) * 1.1)
	else:
		row_w = maxf(maxf(W, 6.0), sqrt(area) * 1.2)
	var x := 0.0
	var y := 0.0
	var row_h := 0.0
	var max_x := 0.0
	var place := []
	for it in items:
		if x + float(it["w"]) > row_w and x > 0.0:
			x = 0.0
			y += row_h + gap
			row_h = 0.0
		place.append({"it": it, "x": x, "y": y})
		x += float(it["w"]) + gap
		row_h = maxf(row_h, float(it["h"]))
		max_x = maxf(max_x, x - gap)
	var tray_w := max_x
	var tray_h := y + row_h
	var ox: float = bb[2] + 1.2 if right else bb[0] + (W - tray_w) / 2.0
	var oy: float = bb[1] + (Hh - tray_h) / 2.0 if right else bb[3] + 1.2
	for e in place:
		var it: Dictionary = e["it"]
		var pl: Array = it["p"]["pl"]
		pl[3] = float(pl[3]) + ox + float(e["x"]) - float(it["b"][0])
		pl[4] = float(pl[4]) + oy + float(e["y"]) - float(it["b"][1])
	_refresh_all()


func _fit_view() -> void:
	var all := _sol_polys.duplicate()
	for p in _pieces:
		all.append(G.placement_verts(p["pl"]))
	var b := G.bbox(all)
	var pad := 1.2
	_view = [b[0] - pad, b[1] - pad, b[2] - b[0] + 2.0 * pad, b[3] - b[1] + 2.0 * pad]
	_update_transform()


func _update_transform() -> void:
	if size.x <= 0.0 or size.y <= 0.0:
		return
	_scale = minf(size.x / float(_view[2]), size.y / float(_view[3]))
	_origin = Vector2(
		(size.x - float(_view[2]) * _scale) / 2.0 - float(_view[0]) * _scale,
		(size.y - float(_view[3]) * _scale) / 2.0 - float(_view[1]) * _scale)
	queue_redraw()


func _w2s(p: Array) -> Vector2:
	return Vector2(float(p[0]) * _scale + _origin.x, float(p[1]) * _scale + _origin.y)


func _s2w(v: Vector2) -> Array:
	return [(v.x - _origin.x) / _scale, (v.y - _origin.y) / _scale]


func _poly_screen(verts: Array) -> PackedVector2Array:
	var out := PackedVector2Array()
	for p in verts:
		out.append(_w2s(p))
	return out


# ---------------------------------------------------------------- Zeichnen

func _draw() -> void:
	if draw_background:
		draw_rect(Rect2(Vector2.ZERO, size), background_color)
	var sw := maxf(1.0, _scale * 0.04)
	for v in _sol_polys:
		var pts := _poly_screen(v)
		draw_colored_polygon(pts, silhouette_color)
		var closed := pts.duplicate()
		closed.append(pts[0])
		draw_polyline(closed, silhouette_color, sw * 1.2)
	if not _ghost.is_empty():
		var gc: Color = _ghost[1]
		var gp := _poly_screen(_ghost[0])
		draw_colored_polygon(gp, Color(gc.r, gc.g, gc.b, 0.6))
		var gclosed := gp.duplicate()
		gclosed.append(gp[0])
		draw_polyline(gclosed, Color.WHITE, sw * 2.0)
	for i in _pieces.size():
		var p: Dictionary = _pieces[i]
		var pts2 := _poly_screen(p["verts"])
		draw_colored_polygon(pts2, p["color"])
		var closed2 := pts2.duplicate()
		closed2.append(pts2[0])
		if i == _sel and not solved:
			draw_polyline(closed2, Color.WHITE, sw * 3.0)
		draw_polyline(closed2, Color(0, 0, 0, 0.55), sw * (0.5 if solved else 1.4))


# ---------------------------------------------------------------- Eingabe

func _gui_input(event: InputEvent) -> void:
	if solved or _pieces.is_empty():
		return
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				grab_focus()
				var i := _piece_at(mb.position)
				if i < 0:
					_select(-1)
					return
				_select(i)
				i = _sel
				if mb.double_click:
					rotate_selected(1)
					return
				var w := _s2w(mb.position)
				var pl: Array = _pieces[i]["pl"]
				_drag = {"ox": w[0] - float(pl[3]), "oy": w[1] - float(pl[4]), "moved": false}
				_touch()
			elif not _drag.is_empty():
				var moved: bool = _drag["moved"]
				_drag = {}
				if moved and _sel >= 0:
					moves += 1
					_snap(_pieces[_sel])
					_check_solved()
					queue_redraw()
		elif mb.button_index == MOUSE_BUTTON_RIGHT and mb.pressed:
			var j := _piece_at(mb.position)
			if j >= 0:
				_select(j)
				rotate_selected(1)
		elif mb.pressed and (mb.button_index == MOUSE_BUTTON_WHEEL_UP or mb.button_index == MOUSE_BUTTON_WHEEL_DOWN):
			if _sel >= 0:
				rotate_selected(-1 if mb.button_index == MOUSE_BUTTON_WHEEL_UP else 1)
	elif event is InputEventMouseMotion and not _drag.is_empty() and _sel >= 0:
		var w2 := _s2w((event as InputEventMouseMotion).position)
		var p: Dictionary = _pieces[_sel]
		var pl2: Array = p["pl"]
		p["pl"] = [pl2[0], pl2[1], pl2[2], w2[0] - float(_drag["ox"]), w2[1] - float(_drag["oy"])]
		_drag["moved"] = true
		_refresh(p)
		queue_redraw()
	elif event is InputEventKey and (event as InputEventKey).pressed:
		var k := event as InputEventKey
		match k.keycode:
			KEY_R:
				rotate_selected(-1 if k.shift_pressed else 1)
				accept_event()
			KEY_F:
				flip_selected()
				accept_event()
			KEY_H:
				show_hint()
				accept_event()
			KEY_ESCAPE:
				_select(-1)
			KEY_LEFT:
				nudge_selected(-0.05, 0.0)
				accept_event()
			KEY_RIGHT:
				nudge_selected(0.05, 0.0)
				accept_event()
			KEY_UP:
				nudge_selected(0.0, -0.05)
				accept_event()
			KEY_DOWN:
				nudge_selected(0.0, 0.05)
				accept_event()


func _piece_at(pos: Vector2) -> int:
	var i := _pieces.size() - 1
	while i >= 0:
		if Geometry2D.is_point_in_polygon(pos, _poly_screen(_pieces[i]["verts"])):
			return i
		i -= 1
	return -1


func _select(i: int) -> void:
	if i >= 0:
		var p: Dictionary = _pieces[i]
		_pieces.remove_at(i)
		_pieces.append(p)
		i = _pieces.size() - 1
	_sel = i
	selection_changed.emit(i >= 0)
	queue_redraw()


func _touch() -> void:
	if _start_ms < 0:
		_start_ms = Time.get_ticks_msec()


func _refresh(p: Dictionary) -> void:
	p["verts"] = G.placement_verts(p["pl"])


func _refresh_all() -> void:
	for p in _pieces:
		_refresh(p)


func _after_change(p: Dictionary, no_snap: bool) -> void:
	moves += 1
	_refresh(p)
	if not no_snap:
		_snap(p)
	_check_solved()
	_touch()
	queue_redraw()


# ---------------------------------------------------------------- Einrasten & Gewinn

func _snap(p: Dictionary) -> void:
	var anchors := []
	for v in _sol_polys:
		for q in v:
			anchors.append(q)
	for o in _pieces:
		if o != p:
			for q in o["verts"]:
				anchors.append(q)
	# Verschiebung wählen, bei der die meisten Ecken des Teils zugleich auf Ankerpunkte fallen;
	# bei Gleichstand die kürzeste.
	var best := []
	var best_score := 0
	var best_dist := INF
	for v in p["verts"]:
		for a in anchors:
			var tx: float = float(a[0]) - float(v[0])
			var ty: float = float(a[1]) - float(v[1])
			var d := sqrt(tx * tx + ty * ty)
			if d >= snap_distance:
				continue
			var score := 0
			for w in p["verts"]:
				for a2 in anchors:
					var ex: float = float(w[0]) + tx - float(a2[0])
					var ey: float = float(w[1]) + ty - float(a2[1])
					if sqrt(ex * ex + ey * ey) < 0.03:
						score += 1
						break
			if score > best_score or (score == best_score and d < best_dist):
				best = [tx, ty]
				best_score = score
				best_dist = d
	if not best.is_empty():
		var pl: Array = p["pl"]
		p["pl"] = [pl[0], pl[1], pl[2], G.round6(float(pl[3]) + best[0]), G.round6(float(pl[4]) + best[1])]
		_refresh(p)


func _check_solved() -> void:
	var cv := coverage()
	progress_changed.emit(cv["covered"])
	if not solved and cv["covered"] >= 0.97 and cv["spill"] <= 0.03:
		solved = true
		_sel = -1
		selection_changed.emit(false)
		queue_redraw()
		puzzle_solved.emit({"moves": moves, "hints": hints, "gave_up": gave_up, "ms": elapsed_ms()})


# ---------------------------------------------------------------- Zuordnung für Tipp / Lösung

func _close(a: Array, b: Array) -> bool:
	for q in a:
		var found := false
		for r in b:
			if sqrt(pow(float(q[0]) - float(r[0]), 2.0) + pow(float(q[1]) - float(r[1]), 2.0)) < 0.06:
				found = true
				break
		if not found:
			return false
	return true


## Ordnet jedem Lösungsteil den Index eines Spielteils gleichen Typs zu (-1 falls keins).
func _assignment() -> Array:
	var used := {}
	var res := []
	res.resize(_sol_pls.size())
	res.fill(-1)
	for si in _sol_pls.size():
		for pi in _pieces.size():
			if used.has(pi) or _pieces[pi]["type"] != _sol_pls[si][0]:
				continue
			if _close(G.placement_verts(_pieces[pi]["pl"]), _sol_polys[si]):
				used[pi] = true
				res[si] = pi
				break
	for si in _sol_pls.size():
		if res[si] >= 0:
			continue
		var best := -1
		var bd := INF
		var sc := G.poly_centroid(_sol_polys[si])
		for pi in _pieces.size():
			if used.has(pi) or _pieces[pi]["type"] != _sol_pls[si][0]:
				continue
			var c := G.poly_centroid(G.placement_verts(_pieces[pi]["pl"]))
			var d := sqrt(pow(float(c[0]) - float(sc[0]), 2.0) + pow(float(c[1]) - float(sc[1]), 2.0))
			if d < bd:
				bd = d
				best = pi
		if best >= 0:
			used[best] = true
			res[si] = best
	return res
