extends SceneTree
## Gibt generierte Puzzles als JSON aus (zum Abgleich mit der JS-Version).

func _init() -> void:
	var out := {}
	for style in TangramGenerator.STYLE_IDS:
		for i in 40:
			var key := "abs:%s:%d" % [style, i]
			out[key] = TangramGenerator.generate_abstract("%s:%d:1" % [style, i], style, 1)
	for style in TangramGenerator.STYLE_IDS:
		for sets in [2, 3]:
			out["abs%d:%s" % [sets, style]] = TangramGenerator.generate_abstract("%s:1000000000000000000000:%d" % [style, sets], style, sets)
	for kind in TangramGenerator.PATTERN_IDS:
		for i in 20:
			out["pat:%s:%d" % [kind, i]] = TangramGenerator.generate_pattern("%s:%d:1" % [kind, i], kind, 1)
	for kind in TangramGenerator.PATTERN_IDS:
		out["pat2:%s" % kind] = TangramGenerator.generate_pattern("%s:77:2" % kind, kind, 2)
	print("JSON>>" + JSON.stringify(out))
	quit()
