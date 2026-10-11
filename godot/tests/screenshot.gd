extends SceneTree
## Rendert die Demo-Szene und speichert einen Screenshot. Aufruf (mit Display, z. B. xvfb-run):
##   godot --path godot --script res://tests/screenshot.gd -- <ausgabe.png> [kategorie] [nummer]

func _initialize() -> void:
	_run()


func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var out := args[0] if args.size() > 0 else "user://shot.png"
	var scene: Control = load("res://demo/main.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	await process_frame
	if args.size() > 2:
		scene.cat_id = args[1]
		scene._go(args[2])
	for i in 6:
		await process_frame
	var img := root.get_texture().get_image()
	img.save_png(out)
	print("gespeichert: ", out, " ", img.get_size())
	quit()
