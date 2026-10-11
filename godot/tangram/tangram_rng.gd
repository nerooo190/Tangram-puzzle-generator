class_name TangramRng
extends RefCounted
## Deterministischer Zufallsgenerator (cyrb128-Seed + sfc32) – liefert exakt dieselben Zahlen
## wie die Web-Version (web/js/core/prng.js).

const M32 := 0xFFFFFFFF

var a: int
var b: int
var c: int
var d: int


static func _imul(x: int, y: int) -> int:
	# x,y < 2^32; ein Überlauf von int64 ändert die unteren 32 Bit nicht.
	return (x * y) & M32


static func cyrb128(s: String) -> Array:
	var h1 := 1779033703
	var h2 := 3144134277
	var h3 := 1013904242
	var h4 := 2773480762
	for i in s.length():
		var k := s.unicode_at(i)
		h1 = h2 ^ _imul(h1 ^ k, 597399067)
		h2 = h3 ^ _imul(h2 ^ k, 2869860233)
		h3 = h4 ^ _imul(h3 ^ k, 951274213)
		h4 = h1 ^ _imul(h4 ^ k, 2716044179)
	h1 = _imul(h3 ^ (h1 >> 18), 597399067)
	h2 = _imul(h4 ^ (h2 >> 22), 2869860233)
	h3 = _imul(h1 ^ (h3 >> 17), 951274213)
	h4 = _imul(h2 ^ (h4 >> 19), 2716044179)
	h1 ^= h2 ^ h3 ^ h4
	h2 ^= h1
	h3 ^= h1
	h4 ^= h1
	return [h1 & M32, h2 & M32, h3 & M32, h4 & M32]


func _init(seed_text: String = "") -> void:
	var s := cyrb128(seed_text)
	a = s[0]
	b = s[1]
	c = s[2]
	d = s[3]
	for i in 15:
		next_u32()


func next_u32() -> int:
	var t0 := (a + b) & M32
	a = (b ^ (b >> 9)) & M32
	b = (c + (c << 3)) & M32
	c = ((c << 21) & M32) | (c >> 11)
	d = (d + 1) & M32
	var t := (t0 + d) & M32
	c = (c + t) & M32
	return t


## Gleitkommazahl in [0,1)
func randf_() -> float:
	return float(next_u32()) / 4294967296.0


## Ganzzahl in [0,n)
func int_(n: int) -> int:
	return (next_u32() * n) >> 32


func shuffle_(arr: Array) -> Array:
	var i := arr.size() - 1
	while i > 0:
		var j := int_(i + 1)
		var t = arr[i]
		arr[i] = arr[j]
		arr[j] = t
		i -= 1
	return arr
