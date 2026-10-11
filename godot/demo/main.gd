extends Control
## Demo: Kategorien, beliebig große Puzzle-Nummern, Spielbrett. Zeigt, wie man die Tangram-Bibliothek nutzt.

const BIG := "1000000000000000000000"

var lib := TangramLibrary.new()
var board: TangramBoard
var cat_list: ItemList
var title_lbl: Label
var sub_lbl: Label
var index_edit: LineEdit
var sets_opt: OptionButton
var status_lbl: Label
var win_panel: PanelContainer
var win_lbl: Label
var cat_id := "alle"
var index := "0"
var sets := 1
var _cats: Array = []
var _token := 0


func _ready() -> void:
	lib.load_default()
	_build_ui()
	_fill_categories()
	_select_category(0)


func _build_ui() -> void:
	var root := HBoxContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_theme_constant_override("separation", 8)
	add_child(root)

	var left := VBoxContainer.new()
	left.custom_minimum_size = Vector2(240, 0)
	root.add_child(left)
	var head := Label.new()
	head.text = "Tangram-Generator"
	head.add_theme_font_size_override("font_size", 20)
	left.add_child(head)
	cat_list = ItemList.new()
	cat_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	cat_list.item_selected.connect(_select_category)
	left.add_child(cat_list)

	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 6)
	root.add_child(right)

	title_lbl = Label.new()
	title_lbl.add_theme_font_size_override("font_size", 26)
	right.add_child(title_lbl)
	sub_lbl = Label.new()
	right.add_child(sub_lbl)

	var nav := HBoxContainer.new()
	right.add_child(nav)
	_btn(nav, "|<", func(): _go("0"))
	_btn(nav, "<", func(): _go(TangramBig.sub_int(index, 1)))
	index_edit = LineEdit.new()
	index_edit.custom_minimum_size = Vector2(300, 0)
	index_edit.text_submitted.connect(func(t): _go(t))
	nav.add_child(index_edit)
	_btn(nav, ">", func(): _go(TangramBig.add_int(index, 1)))
	_btn(nav, "Zufall (bis 10^21)", func(): _go(TangramBig.random_digits(21)))
	_btn(nav, "10^21", func(): _go(BIG))
	var sl := Label.new()
	sl.text = "  Teile:"
	nav.add_child(sl)
	sets_opt = OptionButton.new()
	for s in [7, 14, 21, 28]:
		sets_opt.add_item(str(s))
	sets_opt.item_selected.connect(func(i): sets = i + 1; _go(index))
	nav.add_child(sets_opt)

	var wrap := Control.new()
	wrap.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(wrap)
	board = TangramBoard.new()
	board.set_anchors_preset(Control.PRESET_FULL_RECT)
	board.puzzle_solved.connect(_on_solved)
	board.progress_changed.connect(func(c): status_lbl.text = "Gedeckt: %d %%" % int(c * 100.0))
	wrap.add_child(board)
	win_panel = PanelContainer.new()
	win_panel.set_anchors_preset(Control.PRESET_CENTER)
	win_panel.hide()
	var wv := VBoxContainer.new()
	win_panel.add_child(wv)
	var wt := Label.new()
	wt.text = "Geschafft!"
	wt.add_theme_font_size_override("font_size", 30)
	wt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	wv.add_child(wt)
	win_lbl = Label.new()
	win_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	wv.add_child(win_lbl)
	_btn(wv, "Nächstes Puzzle", func(): _go(TangramBig.add_int(index, 1)))
	wrap.add_child(win_panel)

	var tools := HBoxContainer.new()
	right.add_child(tools)
	_btn(tools, "Drehen -45°", func(): board.rotate_selected(-1))
	_btn(tools, "Drehen +45°", func(): board.rotate_selected(1))
	_btn(tools, "Spiegeln", func(): board.flip_selected())
	_btn(tools, "Tipp (H)", func(): board.show_hint())
	_btn(tools, "Neu mischen", func(): board.shuffle())
	_btn(tools, "Lösung", func(): board.show_solution())
	status_lbl = Label.new()
	status_lbl.text = "Gedeckt: 0 %"
	tools.add_child(status_lbl)


func _btn(parent: Node, text: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.pressed.connect(cb)
	parent.add_child(b)
	return b


func _fill_categories() -> void:
	_cats = lib.categories()
	cat_list.clear()
	for c in _cats:
		var count := " (%d)" % int(c["count"]) if c.has("count") else " (∞)"
		cat_list.add_item(str(c["name"]) + count)


func _select_category(i: int) -> void:
	cat_id = _cats[i]["id"]
	cat_list.select(i)
	var mult := 1
	if _cats[i]["group"] == "pattern":
		mult = {"spiegel": 2, "vier": 4, "punkt": 2}[_cats[i]["pattern"]]
	for k in sets_opt.item_count:
		sets_opt.set_item_text(k, str(7 * (k + 1) * mult))
	_go("0")


func _go(n: String) -> void:
	index = TangramBig.normalize(n)
	index_edit.text = TangramBig.fmt(index)
	var tok := _token + 1
	_token = tok
	win_panel.hide()
	var pz := lib.peek(cat_id, index, sets)
	if pz.is_empty():
		title_lbl.text = "Berechne Variante …"
		sub_lbl.text = "(läuft im Hintergrund-Thread)"
		lib.request(cat_id, index, sets, func(p): if tok == _token: _show(p))
	else:
		_show(pz)


func _show(pz: Dictionary) -> void:
	if pz.is_empty():
		title_lbl.text = "Kein Puzzle"
		return
	title_lbl.text = pz["title"]
	var q := " · Ähnlichkeit %d %%" % int(float(pz["iou"]) * 100.0) if float(pz["iou"]) > 0.0 else ""
	sub_lbl.text = "%s%s" % [pz["subtitle"], q]
	board.load_puzzle(pz)
	board.grab_focus()


func _on_solved(info: Dictionary) -> void:
	var s := int(info["ms"]) / 1000
	win_lbl.text = "Zeit %d:%02d · %d Züge · %d Tipps%s" % [s / 60, s % 60, info["moves"], info["hints"], " · Lösung angezeigt" if info["gave_up"] else ""]
	win_panel.show()
