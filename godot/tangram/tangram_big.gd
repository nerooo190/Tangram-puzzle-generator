class_name TangramBig
extends RefCounted
## Beliebig große nichtnegative ganze Zahlen als Dezimal-String (GDScript hat kein BigInt).
## Genug für Puzzle-Nummern wie 1000000000000000000000.

const MAX_DIGITS := 200


static func normalize(s: String) -> String:
	var out := ""
	for ch in s:
		if ch >= "0" and ch <= "9":
			out += ch
	out = out.lstrip("0")
	if out.is_empty():
		return "0"
	return out.substr(0, MAX_DIGITS)


static func cmp(a: String, b: String) -> int:
	if a.length() != b.length():
		return -1 if a.length() < b.length() else 1
	if a == b:
		return 0
	return -1 if a < b else 1


static func add(a: String, b: String) -> String:
	var i := a.length() - 1
	var j := b.length() - 1
	var carry := 0
	var out := ""
	while i >= 0 or j >= 0 or carry > 0:
		var s := carry
		if i >= 0:
			s += a.unicode_at(i) - 48
			i -= 1
		if j >= 0:
			s += b.unicode_at(j) - 48
			j -= 1
		out = str(s % 10) + out
		carry = s / 10
	return normalize(out)


## a - b, nie kleiner als 0
static func sub(a: String, b: String) -> String:
	if cmp(a, b) <= 0:
		return "0"
	var i := a.length() - 1
	var j := b.length() - 1
	var borrow := 0
	var out := ""
	while i >= 0:
		var d := a.unicode_at(i) - 48 - borrow
		if j >= 0:
			d -= b.unicode_at(j) - 48
			j -= 1
		if d < 0:
			d += 10
			borrow = 1
		else:
			borrow = 0
		out = str(d) + out
		i -= 1
	return normalize(out)


static func add_int(a: String, k: int) -> String:
	return add(a, str(k))


static func sub_int(a: String, k: int) -> String:
	return sub(a, str(k))


static func mod_small(s: String, m: int) -> int:
	var r := 0
	for ch in s:
		r = (r * 10 + (ch.unicode_at(0) - 48)) % m
	return r


static func div_small(s: String, m: int) -> String:
	var out := ""
	var r := 0
	for ch in s:
		r = r * 10 + (ch.unicode_at(0) - 48)
		out += str(r / m)
		r = r % m
	return normalize(out)


## Zufällige Zahl in [0, 10^digits)
static func random_digits(digits: int, rng: RandomNumberGenerator = null) -> String:
	var r := rng if rng != null else RandomNumberGenerator.new()
	if rng == null:
		r.randomize()
	var out := ""
	for i in digits:
		out += str(r.randi_range(0, 9))
	return normalize(out)


## Tausendertrennung: 1000000 -> "1.000.000"
static func fmt(s: String, sep: String = ".") -> String:
	var out := ""
	var n := s.length()
	for i in n:
		out += s[i]
		var left := n - 1 - i
		if left > 0 and left % 3 == 0:
			out += sep
	return out
