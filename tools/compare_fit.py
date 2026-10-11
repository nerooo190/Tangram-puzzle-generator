import json, sys
def load(p):
    for line in open(p):
        if line.startswith('JSON>>'): return json.loads(line[6:])
    raise SystemExit('no JSON in ' + p)
a, b = load(sys.argv[1]), load(sys.argv[2])
bad = 0
for k in a:
    x, y = a[k], b.get(k)
    same = y is not None and len(x) == len(y) and all(
        s['iou'] == t['iou'] and len(s['pls']) == len(t['pls']) and all(
            p[:3] == [int(v) for v in q[:3]] and abs(p[3] - q[3]) < 1e-5 and abs(p[4] - q[4]) < 1e-5
            for p, q in zip(s['pls'], t['pls']))
        for s, t in zip(x, y))
    print(('identisch ' if same else 'ABWEICHUNG ') + k, [s['iou'] for s in x])
    bad += 0 if same else 1
sys.exit(1 if bad else 0)
