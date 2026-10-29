"""Build data/basemap.json: the grayscale basemap under the census layer.

Inside the city it uses the City of Guelph property parcels: road, laneway and walkway parcels are the
rights-of-way (ROWs); every other parcel fills in the blocks between them. Outside the city it uses
OpenStreetMap streets, buildings and water for a band around the boundary, so the map doesn't stop
at the city limits.

Inputs (one folder)
  _parcels/p*.json        City of Guelph Property layer (OpenData1/FeatureServer/16) as GeoJSON pages
  _osm_ring/roads_all.json, b_*.json, water.json   Overpass extracts (out geom) for the area around Guelph
  City_Boundary.geojson
Usage
  python build_basemap.py "<City of Guelph Data>" data/
"""
import glob, json, math, os, sys

SRC, OUT = (sys.argv[1:3] + [None, None])[:2]
SRC = SRC or "/mnt/user-data/uploads/City of Guelph Data"
OUT = OUT or "data"
MARGIN_KM = 3.0          # how far past the city limits the basemap reaches (panning stops near here)

# ---------- helpers ----------
LAT0 = 43.53
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110540     # metres per degree

def simplify(pts, tol):
    """Douglas-Peucker in metres. Closed rings are split at their farthest vertex first."""
    if len(pts) < 3: return pts
    if pts[0] == pts[-1] and len(pts) > 4:
        far = max(range(1, len(pts) - 1), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 * KX * KX + (pts[i][1] - pts[0][1]) ** 2 * KY * KY)
        return simplify(pts[:far + 1], tol)[:-1] + simplify(pts[far:], tol)
    keep = [False] * len(pts); keep[0] = keep[-1] = True; stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop(); ax, ay = pts[a][0] * KX, pts[a][1] * KY; bx, by = pts[b][0] * KX, pts[b][1] * KY
        dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy) or 1e-9; best, bi = -1, -1
        for i in range(a + 1, b):
            px, py = pts[i][0] * KX, pts[i][1] * KY
            d = abs(dy * (px - ax) - dx * (py - ay)) / L
            if d > best: best, bi = d, i
        if best > tol: keep[bi] = True; stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]

def enc(pts):
    """Delta-encoded integer lon/lat at 1e-5 degrees (about 1 m), the same scheme as context.json."""
    out, px, py = [], 0, 0
    for x, y in pts:
        X, Y = round(x * 1e5), round(y * 1e5)
        if out and X == px and Y == py: continue
        out += [X - px, Y - py]; px, py = X, Y
    return out

# ---------- city boundary ----------
bnd = json.load(open(os.path.join(SRC, "City_Boundary.geojson")))["features"][0]["geometry"]
ring = bnd["coordinates"][0] if bnd["type"] == "Polygon" else bnd["coordinates"][0][0]
xs, ys = [p[0] for p in ring], [p[1] for p in ring]
BX0, BX1 = min(xs) - MARGIN_KM * 1000 / KX, max(xs) + MARGIN_KM * 1000 / KX
BY0, BY1 = min(ys) - MARGIN_KM * 1000 / KY, max(ys) + MARGIN_KM * 1000 / KY

def inside(x, y, r=ring):
    c = False; j = len(r) - 1
    for i in range(len(r)):
        xi, yi = r[i]; xj, yj = r[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
        j = i
    return c
# coarse grid cache for point-in-city tests
RING_BOX = (min(xs), min(ys), max(xs), max(ys))
def in_city(x, y):
    if not (RING_BOX[0] <= x <= RING_BOX[2] and RING_BOX[1] <= y <= RING_BOX[3]): return False
    return inside(x, y)
in_box = lambda x, y: BX0 <= x <= BX1 and BY0 <= y <= BY1

# ---------- parcels: blocks and rights-of-way ----------
ROW = {"ROAD PARCEL", "LANEWAY", "WALKWAY"}
parcels = []
n_row = n_blk = 0
for p in sorted(glob.glob(os.path.join(SRC, "_parcels", "*.json"))):
    for f in json.load(open(p))["features"]:
        g = f["geometry"]
        if not g: continue
        t = f["properties"].get("PARCELTYPE") or ""
        kind = 1 if t in ROW else 2 if t == "RAILWAY PARCEL" else 0
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for poly in polys:
            rings = []
            for r in poly:
                s = simplify([tuple(q) for q in r], 0.6)
                if len(s) >= 4: rings.append(enc(s))
            if rings: parcels.append([kind] + rings)
        if kind == 1: n_row += 1
        else: n_blk += 1

# ---------- OSM outside the city ----------
CLS = {"motorway": 4, "trunk": 4, "motorway_link": 3, "trunk_link": 3, "primary": 3, "secondary": 3, "primary_link": 2,
       "secondary_link": 2, "tertiary": 2, "tertiary_link": 2, "unclassified": 1, "residential": 1, "living_street": 1, "track": 0}
roads = []
for e in json.load(open(os.path.join(SRC, "_osm_ring", "roads_all.json")))["elements"]:
    c = CLS.get(e.get("tags", {}).get("highway"))
    if c is None or "geometry" not in e: continue
    pts = [(q["lon"], q["lat"]) for q in e["geometry"]]
    out = [not in_city(x, y) and in_box(x, y) for x, y in pts]
    # keep runs of vertices outside the city, plus the neighbouring vertex so lines reach the boundary
    i = 0
    while i < len(pts):
        if not out[i]: i += 1; continue
        j = i
        while j < len(pts) and out[j]: j += 1
        run = pts[max(0, i - 1):min(len(pts), j + 1)]
        run = simplify(run, 1.5)
        if len(run) >= 2: roads.append([c, enc(run)])
        i = j

bldg = []
for p in sorted(glob.glob(os.path.join(SRC, "_osm_ring", "b_*.json"))):
    for e in json.load(open(p))["elements"]:
        if "geometry" not in e: continue
        pts = [(q["lon"], q["lat"]) for q in e["geometry"]]
        cx, cy = sum(x for x, _ in pts) / len(pts), sum(y for _, y in pts) / len(pts)
        if not in_box(cx, cy) or in_city(cx, cy): continue
        s = simplify(pts, 0.8)
        if len(s) >= 4: bldg.append(enc(s))

water, streams = [], []
W = json.load(open(os.path.join(SRC, "_osm_ring", "water.json")))["elements"]
for e in W:
    tg = e.get("tags", {})
    if e["type"] == "way" and "geometry" in e:
        pts = [(q["lon"], q["lat"]) for q in e["geometry"]]
        cx, cy = sum(x for x, _ in pts) / len(pts), sum(y for _, y in pts) / len(pts)
        if not in_box(cx, cy): continue
        if tg.get("waterway") in ("river", "stream"):
            if all(in_city(x, y) for x, y in pts[::3]): continue
            s = simplify(pts, 2)
            if len(s) >= 2: streams.append([1 if tg["waterway"] == "river" else 0, enc(s)])
        elif tg.get("natural") == "water" and pts[0] == pts[-1]:
            if in_city(cx, cy): continue
            s = simplify(pts, 1.5)
            if len(s) >= 4: water.append(enc(s))
    elif e["type"] == "relation":
        for m in e.get("members", []):
            if m.get("role") == "outer" and m.get("geometry"):
                pts = [(q["lon"], q["lat"]) for q in m["geometry"]]
                if len(pts) < 4 or pts[0] != pts[-1]: continue
                cx, cy = sum(x for x, _ in pts) / len(pts), sum(y for _, y in pts) / len(pts)
                if not in_box(cx, cy) or in_city(cx, cy): continue
                water.append(enc(simplify(pts, 1.5)))

ext = [round(BX0, 5), round(BY0, 5), round(BX1, 5), round(BY1, 5)]
os.makedirs(OUT, exist_ok=True)
dst = os.path.join(OUT, "basemap.json")
json.dump({"ext": ext, "p": parcels, "r": roads, "b": bldg, "w": water, "s": streams}, open(dst, "w"), separators=(",", ":"))
print(f"parcels {len(parcels)} (rows {n_row}, blocks {n_blk}); outside: roads {len(roads)}, buildings {len(bldg)}, water {len(water)}, streams {len(streams)}; {os.path.getsize(dst)//1024} KB")
