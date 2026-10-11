extends SceneTree
## Löst einige Figuren mit dem GDScript-Solver und gibt das Ergebnis als JSON aus (Abgleich mit JS).

func _init() -> void:
	var pack: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://tangram/data/packs/tiere.json"))
	var out := {}
	var t0 := Time.get_ticks_msec()
	for fi in [0, 5, 12]:
		var fig: Dictionary = pack["figures"][fi]
		var mask := TangramFit.mask_from_json(fig["mask"])
		var sols := TangramFit.solve(mask, {"sets": 1, "seed": "test:%s" % fig["id"], "restarts": 3, "iters": 6000, "topK": 3})
		out[fig["id"]] = sols
	print("ms=", Time.get_ticks_msec() - t0)
	print("JSON>>" + JSON.stringify(out))
	quit()
