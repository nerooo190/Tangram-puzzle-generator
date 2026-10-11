extends SceneTree
## Spielbrett-Test: Puzzle laden, Teil per Maus ziehen, drehen, Tipp, Lösung -> Gewinn-Signal.

var fails := 0
var solved_info := {}

func check(c: bool, msg: String) -> void:
	print(("OK   " if c else "FAIL ") + msg)
	if not c:
		fails += 1

func _initialize() -> void:
	_run()


func _run() -> void:
	await process_frame
	var lib := TangramLibrary.new()
	lib.load_default()
	var board := TangramBoard.new()
	board.size = Vector2(1000, 700)
	root.add_child(board)
	board.puzzle_solved.connect(func(i): solved_info = i)
	var pz := lib.peek("tiere", "3")
	board.load_puzzle(pz)
	check(board._pieces.size() == 7, "7 Teile geladen")
	check(board.coverage()["covered"] < 0.5, "Anfangs ungelöst (%.2f)" % board.coverage()["covered"])
	# Maus: erstes Teil ziehen
	var p: Dictionary = board._pieces[board._pieces.size() - 1]
	var before: Array = p["pl"].duplicate()
	var c := TangramGeom.poly_centroid(p["verts"])
	var scr := board._w2s(c)
	var ev := InputEventMouseButton.new()
	ev.button_index = MOUSE_BUTTON_LEFT
	ev.pressed = true
	ev.position = scr
	board._gui_input(ev)
	check(board.has_selection(), "Klick wählt Teil aus")
	var mv := InputEventMouseMotion.new()
	mv.position = scr + Vector2(80, -50)
	board._gui_input(mv)
	var up := InputEventMouseButton.new()
	up.button_index = MOUSE_BUTTON_LEFT
	up.pressed = false
	up.position = scr + Vector2(80, -50)
	board._gui_input(up)
	var after: Array = board._pieces[board._sel]["pl"]
	check(before[3] != after[3] or before[4] != after[4], "Teil wurde verschoben")
	var r0: int = after[1]
	board.rotate_selected(1)
	check(board._pieces[board._sel]["pl"][1] == (r0 + 1) % 8, "Drehen um 45°")
	check(board.show_hint(), "Tipp zeigt Geisterteil")
	board.show_solution()
	check(board.solved and not solved_info.is_empty(), "Lösung wird als gelöst erkannt")
	check(solved_info.get("gave_up", false), "gave_up gesetzt")
	# Exaktes Platzieren (kein show_solution): jedes Teil per Code auf Lösung -> solved
	board.load_puzzle(lib.peek("essen", "5"))
	var asg := board._assignment()
	for si in asg.size():
		board._pieces[asg[si]]["pl"] = board._sol_pls[si].duplicate()
		board._refresh(board._pieces[asg[si]])
	board._check_solved()
	check(board.solved, "Manuell exakt gelegt -> gelöst")
	print("FAILS=", fails)
	quit(1 if fails > 0 else 0)
