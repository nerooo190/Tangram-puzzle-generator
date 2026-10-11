import json, sys
def load(p):
    for line in open(p):
        if line.startswith('JSON>>'): return json.loads(line[6:])
    raise SystemExit('no JSON in '+p)
a, b = load(sys.argv[1]), load(sys.argv[2])
bad = 0
for k in a:
    x, y = a[k], b.get(k)
    if y is None or len(x) != len(y): print('DIFF len', k); bad += 1; continue
    worst = 0
    for p, q in zip(x, y):
        if p[:3] != [int(v) for v in q[:3]]: worst = 9; break
        worst = max(worst, abs(p[3]-q[3]), abs(p[4]-q[4]))
    if worst > 1e-5: print('DIFF', k, worst); bad += 1
print(f'{len(a)-bad}/{len(a)} identisch')
sys.exit(1 if bad else 0)
