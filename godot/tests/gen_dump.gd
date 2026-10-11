extends SceneTree
## Gibt generierte Puzzles als JSON aus (zum Abgleich mit der JS-Version).

func _init() -> void:
	var out := {}
	for style in TangramGenerator.STYLE_IDS:
		for i in 3:
			var key := "abs:%s:%d" % [style, i]
			out[key] = TangramGenerator.generate_abstract("%s:%d:1" % [style, i], style, 1)
	for style in ["frei", "kompakt"]:
		out["abs2:%s" % style] = TangramGenerator.generate_abstract("%s:1000000000000000000000:2" % style, style, 2)
	for kind in TangramGenerator.PATTERN_IDS:
		for i in 3:
			out["pat:%s:%d" % [kind, i]] = TangramGenerator.generate_pattern("%s:%d" % [kind, i], kind)
	print("JSON>>" + JSON.stringify(out))
	quit()
