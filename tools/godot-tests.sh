#!/usr/bin/env bash
# Führt alle Godot-Tests aus und gleicht den GDScript-Port mit der JS-Version ab.
# Aufruf: GODOT=/pfad/zu/godot tools/godot-tests.sh   (Godot 4.3+, headless)
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
run() { timeout "${2:-300}" "$GODOT" --headless --path godot "${@:3}" --script "$1" 2>&1 | grep -v "^Godot Engine"; }

echo "== Projekt importieren"
timeout 120 "$GODOT" --headless --path godot --import >/dev/null 2>&1 || true

echo "== Generator: JS gegen GDScript (Seeds inkl. 10^21, 14 Teile, Muster)"
node tools/gen_dump.mjs > "$TMP/js_gen.txt"
run res://tests/gen_dump.gd 120 > "$TMP/gd_gen.txt"
python3 tools/compare_dump.py "$TMP/js_gen.txt" "$TMP/gd_gen.txt"

echo "== Solver: JS gegen GDScript (bit-identische Lösungen)"
node tools/fit_dump.mjs > "$TMP/js_fit.txt"
run res://tests/fit_dump.gd 300 > "$TMP/gd_fit.txt"
python3 tools/compare_fit.py "$TMP/js_fit.txt" "$TMP/gd_fit.txt"

echo "== Bibliothek / Große Zahlen"
run res://tests/lib_test.gd 200 | tee "$TMP/lib.txt"
grep -q "FAILS=0" "$TMP/lib.txt"

echo "== Spielbrett"
run res://tests/board_test.gd 200 | tee "$TMP/board.txt"
grep -q "FAILS=0" "$TMP/board.txt"
echo "Alle Godot-Tests bestanden"
