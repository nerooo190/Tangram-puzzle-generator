class_name TangramLibrary
extends RefCounted
## Zugriff auf alle Puzzles: gebackene Formen-Pakete (Tiere, Essen, ...), unendliche prozedurale
## Kategorien, Muster und eigene Pakete. Puzzle-Nummern sind Dezimal-Strings beliebiger Länge.
##
## Beispiel:
##   var lib := TangramLibrary.new()
##   lib.load_default()
##   var pz := lib.peek("tiere", "42")                      # sofort verfügbar?
##   lib.request("tiere", "1000000000000000000000", 1, func(p): board.load_puzzle(p))

const PACK_DIR := "res://tangram/data/packs"
const USER_DIR := "user://tangram_packs"

const PROC := [
	{"id": "zufall", "name": "Zufall", "icon": "", "group": "abstract", "style": "frei"},
	{"id": "kompakt", "name": "Kompakt", "icon": "", "group": "abstract", "style": "kompakt"},
	{"id": "lang", "name": "Lang & schlank", "icon": "", "group": "abstract", "style": "lang"},
	{"id": "verzweigt", "name": "Verzweigt", "icon": "", "group": "abstract", "style": "verzweigt"},
	{"id": "spiegel", "name": "Spiegel-Muster", "icon": "", "group": "pattern", "pattern": "spiegel"},
	{"id": "kaleidoskop", "name": "Kaleidoskop", "icon": "", "group": "pattern", "pattern": "vier"},
	{"id": "punkt", "name": "Punktsymmetrie", "icon": "", "group": "pattern", "pattern": "punkt"},
]

## Qualität der Live-Berechnung (GDScript ist ~40x langsamer als JS; 3x8000 ≈ 4 s im Thread).
## Für dieselben Varianten wie im Web: live_restarts = 10, live_iters = 14000 (≈ 25 s).
var live_restarts := 3
var live_iters := 8000

var packs: Array = []        # [{id,name,icon,figures:[{id,name,glyph,mask,sols}]}]
var user_packs: Array = []
var _cache := {}
var _threads: Array = []
var _jobs := {}


func load_default(dir: String = PACK_DIR) -> void:
	packs.clear()
	var index_text := FileAccess.get_file_as_string(dir.path_join("index.json"))
	if index_text.is_empty():
		push_warning("TangramLibrary: keine Pakete unter %s" % dir)
		return
	for e in JSON.parse_string(index_text):
		var p = JSON.parse_string(FileAccess.get_file_as_string(dir.path_join("%s.json" % e["id"])))
		if p is Dictionary:
			packs.append(p)
	load_user_packs()


func load_user_packs(dir: String = USER_DIR) -> void:
	user_packs.clear()
	var d := DirAccess.open(dir)
	if d == null:
		return
	for f in d.get_files():
		if f.ends_with(".json"):
			var p = JSON.parse_string(FileAccess.get_file_as_string(dir.path_join(f)))
			if p is Dictionary and p.get("format", "") == "tangram-pack/1":
				user_packs.append(p)


## Fügt ein Paket hinzu (z. B. aus der Web-App exportiert) und speichert es unter user://.
func add_user_pack(pack: Dictionary, save: bool = true) -> void:
	for i in user_packs.size():
		if user_packs[i]["id"] == pack["id"]:
			user_packs[i] = pack
			_cache.clear()
			if save:
				_save_pack(pack)
			return
	user_packs.append(pack)
	if save:
		_save_pack(pack)


func _save_pack(pack: Dictionary) -> void:
	DirAccess.make_dir_recursive_absolute(USER_DIR)
	var f := FileAccess.open(USER_DIR.path_join("%s.json" % pack["id"]), FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(pack))


func add_pack_from_file(path: String) -> bool:
	var p = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (p is Dictionary) or p.get("format", "") != "tangram-pack/1" or not p.has("figures"):
		return false
	add_user_pack(p)
	return true


## Alle Kategorien: [{id,name,icon,group,figures?,count?}]
func categories() -> Array:
	var out := []
	var all := []
	for p in packs:
		all.append_array(p["figures"])
	if not all.is_empty():
		out.append({"id": "alle", "name": "Alle bekannten Formen", "icon": "", "group": "known", "figures": all, "count": all.size()})
	for p in packs:
		out.append({"id": p["id"], "name": p["name"], "icon": p.get("icon", ""), "group": "known", "figures": p["figures"], "count": p["figures"].size()})
	for c in PROC:
		out.append(c.duplicate())
	for p in user_packs:
		out.append({"id": p["id"], "name": p["name"], "icon": p.get("icon", ""), "group": "custom", "figures": p["figures"], "count": p["figures"].size()})
	return out


func category(id: String) -> Dictionary:
	for c in categories():
		if c["id"] == id:
			return c
	return {}


func _make(cat: Dictionary, index: String, sets: int, title: String, subtitle: String, glyph: String, pls: Array, iou: float) -> Dictionary:
	return {
		"key": "%s|%s|%d" % [cat["id"], index, sets], "cat_id": cat["id"], "index": index, "sets": sets,
		"title": title, "subtitle": subtitle, "glyph": glyph, "pls": pls, "iou": iou,
	}


## Sofort verfügbares Puzzle oder {} (dann muss request() im Hintergrund rechnen).
func peek(cat_id: String, index_text: String, sets: int = 1) -> Dictionary:
	var cat := category(cat_id)
	if cat.is_empty():
		return {}
	var index := TangramBig.normalize(index_text)
	var key := "%s|%s|%d" % [cat_id, index, sets]
	if _cache.has(key):
		return _cache[key]
	var pz := {}
	if cat.has("figures"):
		var figs: Array = cat["figures"]
		var F := figs.size()
		if F == 0:
			return {}
		var fig: Dictionary = figs[TangramBig.mod_small(index, F)]
		var v := TangramBig.div_small(index, F)
		var sols: Array = fig.get("sols", [])
		if sets == 1 and TangramBig.cmp(v, str(sols.size())) < 0:
			var s: Dictionary = sols[int(v)]
			pz = _make(cat, index, sets, fig["name"], "Variante %s" % TangramBig.fmt(TangramBig.add_int(v, 1)), fig.get("glyph", ""), s["p"], float(s["iou"]))
	elif cat["group"] == "abstract":
		var pls := TangramGenerator.generate_abstract("%s:%s:%d" % [cat_id, index, sets], cat["style"], sets)
		if not pls.is_empty():
			pz = _make(cat, index, sets, "%s Nr. %s" % [cat["name"], TangramBig.fmt(index)], "%d Teile" % (sets * 7), "", pls, 0.0)
	elif cat["group"] == "pattern":
		var pls2 := TangramGenerator.generate_pattern("%s:%s:%d" % [cat_id, index, sets], cat["pattern"], sets)
		if not pls2.is_empty():
			pz = _make(cat, index, sets, "%s Nr. %s" % [cat["name"], TangramBig.fmt(index)], "%d Teile" % pls2.size(), "", pls2, 0.0)
	if not pz.is_empty():
		_cache[key] = pz
	return pz


## Liefert das Puzzle über `callback(puzzle: Dictionary)` (bei Bedarf asynchron aus einem Thread).
## Gibt true zurück, wenn sofort geliefert wurde.
func request(cat_id: String, index_text: String, sets: int, callback: Callable) -> bool:
	var pz := peek(cat_id, index_text, sets)
	if not pz.is_empty():
		callback.call(pz)
		return true
	var cat := category(cat_id)
	if cat.is_empty() or not cat.has("figures") or cat["figures"].is_empty():
		callback.call({})
		return true
	var index := TangramBig.normalize(index_text)
	var t := Thread.new()
	_threads.append(t)
	t.start(_solve_thread.bind(cat, index, sets, callback, t))
	return false


func _solve_thread(cat: Dictionary, index: String, sets: int, callback: Callable, t: Thread) -> void:
	var figs: Array = cat["figures"]
	var fig: Dictionary = figs[TangramBig.mod_small(index, figs.size())]
	var v := TangramBig.div_small(index, figs.size())
	var mask := TangramFit.mask_from_json(fig["mask"])
	var sols := TangramFit.solve(mask, {
		"sets": sets, "seed": "%s:%s:%d" % [fig["id"], v, sets],
		"restarts": live_restarts, "iters": live_iters, "topK": 1,
	})
	var sub := "Variante %s" % TangramBig.fmt(TangramBig.add_int(v, 1))
	if sets > 1:
		sub += " · %d Teile" % (sets * 7)
	var pz := _make(cat, index, sets, fig["name"], sub, fig.get("glyph", ""), sols[0]["pls"], float(sols[0]["iou"]))
	call_deferred("_deliver", pz, callback, t)


func _deliver(pz: Dictionary, callback: Callable, t: Thread) -> void:
	t.wait_to_finish()
	_threads.erase(t)
	_cache[pz["key"]] = pz
	callback.call(pz)


func is_busy() -> bool:
	return not _threads.is_empty()
