extends SceneTree
## Selbsttest von TangramBig und TangramLibrary.

var fails := 0

func check(c: bool, msg: String) -> void:
	print(("OK   " if c else "FAIL ") + msg)
	if not c:
		fails += 1

func _init() -> void:
	# Große Zahlen
	var big := "1000000000000000000000"
	check(TangramBig.add_int(big, 1) == "1000000000000000000001", "add_int 10^21 + 1")
	check(TangramBig.sub_int(big, 1) == "999999999999999999999", "sub_int 10^21 - 1")
	check(TangramBig.sub_int("5", 9) == "0", "sub klemmt bei 0")
	check(TangramBig.mod_small("1000000000000000000000", 7) == 6, "10^21 mod 7 == 6")   # 10^21 mod 7: 10^6≡1 -> 10^21=10^(18+3)≡10^3≡6
	check(TangramBig.div_small("1000000000000000000000", 8) == "125000000000000000000", "10^21 div 8")
	check(TangramBig.fmt("1000000000000000000000") == "1.000.000.000.000.000.000.000", "fmt")
	check(TangramBig.cmp("9", "10") == -1 and TangramBig.cmp("10", "10") == 0, "cmp")
	check(TangramBig.normalize(" 0012,345 ") == "12345", "normalize")
	var r := TangramRng.new("tangram")
	check([r.next_u32(), r.next_u32(), r.next_u32()] == [3038352894, 2882657882, 1370931434], "RNG: gleiche Zahlen wie JS")
	# Bibliothek
	var lib := TangramLibrary.new()
	lib.load_default()
	var cats := lib.categories()
	check(cats.size() >= 19, "Kategorien: %d" % cats.size())
	var pz := lib.peek("tiere", "3")
	check(not pz.is_empty() and pz["pls"].size() == 7, "tiere #3 gebacken (%s)" % pz.get("title", "?"))
	var pz2 := lib.peek("kompakt", big)
	check(pz2["pls"].size() == 7, "kompakt #10^21 prozedural")
	var pz3 := lib.peek("kaleidoskop", "7")
	check(pz3["pls"].size() == 28, "kaleidoskop hat 28 Teile")
	var F: int = lib.category("tiere")["figures"].size()
	var live := lib.peek("tiere", str(F * 40 + 5))
	check(live.is_empty(), "Variante außerhalb der gebackenen braucht Live-Solver")
	# Live-Solve (Thread) – im Test synchron über den Solver selbst
	var cat := lib.category("tiere")
	var fig: Dictionary = cat["figures"][5]
	var sols := TangramFit.solve(TangramFit.mask_from_json(fig["mask"]), {"sets": 1, "seed": "x", "restarts": 1, "iters": 800, "topK": 1})
	check(sols.size() == 1 and sols[0]["pls"].size() == 7 and sols[0]["iou"] > 0.5, "Solver liefert Lösung (IoU %.2f)" % sols[0]["iou"])
	print("FAILS=", fails)
	quit(1 if fails > 0 else 0)
