# Guelph Census Explorer

Explore the 2021 Census across Guelph's 201 neighbourhoods (Statistics Canada dissemination areas).

- **Map any of 40 measures** across people, background, education and work, income, housing, commuting and access, with natural breaks (Jenks), quantile or equal-interval classes, 4 to 7 classes.
- **Neighbourhood profiles.** Tap a neighbourhood to see every measure beside the city figure, with a strip showing where it ranks among all 201.
- **Compare two neighbourhoods** side by side, with the difference for each measure.
- **See how two measures relate.** A scatter plot of any two measures with the correlation (r) explained in plain language. Tap a dot to open that neighbourhood.
- **Highest and lowest** five neighbourhoods for the mapped measure.
- **Find any address or street.** Search all 55,873 Guelph civic addresses: the app marks the address and opens its neighbourhood. Each neighbourhood is named after the two streets with the most length inside it.
- **City boundary** drawn from the City of Guelph's official boundary, with the area outside it faded.
- **Rotated to Guelph's grid.** The map is turned 46° clockwise so the city's street grid runs up and down and the city reads tall, with the Eramosa River heading to the upper right. A north arrow shows true north. The rotation is built into the map projection (`ROT_DEG` in `scripts/app.js`; negative turns clockwise), so clicks, search and zoom-to-fit all follow it.
- **Grayscale basemap.** Inside the city, the City of Guelph property parcels draw the blocks and rights-of-way (road, laneway and walkway parcels), and the rights-of-way show softly over the census colours. Outside the city, OpenStreetMap streets, buildings and water reach about 3 km past the limits. Built by `scripts/build_basemap.py` into `data/basemap.json`.
- **Zoom and pan limits.** The opening view (the whole city) is the furthest you can zoom out; you can zoom in and pan, and panning stops a little past the city limits.
- **Phone layout: Explore and Analyze.** Explore is for the public: search, measure chips and a plain-language card for the chosen neighbourhood. Analyze is for staff: compare two neighbourhoods (A and B), a full ranked list, how two measures relate, and CSV export.
- **Selection colours** complement each colour ramp (orange on blue, violet on amber, magenta on green) over a white edge.
- **Streets and buildings for context.** Main roads show at every zoom, collector and local streets fade in as you zoom, and street names follow the streets. All 38,908 building footprints appear from about zoom 14.5.

## Desktop and phone versions

- **`index.html` (desktop):** the map on the left, with a scrolling analysis panel on the right.
- **`mobile.html` (phone):** a full-screen map with search on top and a bottom tab bar (Measure, Profile, Relate, Rankings). The tabs open a sheet that slides up, and you can drag its handle between peek, half and full height. The peek strip always shows the mapped measure, the selected neighbourhood's value, and where it sits on the colour scale.

Phones and narrow windows (760 px or less) that open `index.html` are sent to `mobile.html` automatically. Each page links to the other, and a visitor who switches to desktop on a phone stays there.

A sister app to [15-Minute Guelph](https://github.com/randyharris1999-cloud/15-Minute-Guelph). It includes that app's 15-minute score for each neighbourhood.

## What's in the folder

| Path | What it is |
|---|---|
| `index.html` | Desktop version |
| `mobile.html` | Phone version |
| `leaflet.min.js` | Leaflet 1.9.4 map library |
| `data/explorer.json` | Neighbourhood polygons, census values, city boundary, street names, water and main roads |
| `data/addresses.json` | Every civic address with its neighbourhood, loaded after the map so the page opens quickly |
| `data/context.json` | Building footprints and every named street segment, also loaded after the map |
| `scripts/build_explorer.py` | Builds both data files from the Census extract, `City_Boundary.geojson` and the 15-Minute Guelph `data/` folder |
| `scripts/app.js` | App code shared by both versions |
| `scripts/desktop.src.html`, `scripts/mobile.src.html` | Layout and styles for each version |
| `scripts/build_html.py` | Combines each layout with `app.js` and the Leaflet stylesheet to write `index.html` and `mobile.html` |

## Publishing

Upload the folder to a new GitHub repository and turn on GitHub Pages (Settings → Pages → Deploy from branch → `main`, root). No Cloudflare relay is needed: the app has no live feeds.

To test locally, run `python -m http.server 8000` in the folder and open http://localhost:8000. Opening `index.html` directly from disk won't load the data.

## Rebuilding

1. Cut Guelph out of the Ontario Census Profile (`98-401-X2021006_English_CSV_data_Ontario.csv`, 8.8 GB) into `Guelph_DA_census_full.csv`: every characteristic for Guelph's 220 DAs and the City of Guelph census subdivision (DGUID `2021A00053523008`). Use the starting-row file to jump close to line 29,162,006, then keep rows whose DGUID is in `Guelph_DA_2021.geojson`.
2. Build the data and the page:

```
python scripts/build_explorer.py "<City of Guelph Data>/Census 2021" ../15-minute-guelph/data/ data/
python scripts/build_html.py
```

To add a measure, add one line to the `M` list in `build_explorer.py` with its Census Profile characteristic IDs. The app picks it up automatically.

## Data

| Data | Source |
|---|---|
| Population, age, income, low income, housing, commuting | Statistics Canada, 2021 Census of Population, dissemination areas (Statistics Canada Open Licence) |
| Addresses, city boundary, buildings, streets, water, neighbourhood names | City of Guelph Open Data |
| 15-minute score | 15-Minute Guelph |

Notes:

- Incomes are for 2020, when pandemic benefits raised some low incomes.
- City figures are Statistics Canada's own figures for the City of Guelph census subdivision.
- Most measures beyond population, age, households and income come from the 25% long-form sample, so small neighbourhoods can vary a lot.
- Work and commuting figures describe May 2021, during the pandemic.
- The app maps the 201 DAs that contain Guelph address points. The 19 others are mostly rural edges outside the city's address data.
- Values Statistics Canada suppressed for privacy appear as "Not reported".

An independent project built on open data. Not an official City of Guelph service.

## Copyright

© 2026 Randy Harris. All rights reserved.

The code, design and layout of Guelph Census Explorer are not open source. You're welcome to use the app and to view this repository on GitHub, but you may not copy, modify, redistribute or republish the code or design, in whole or in part, without written permission. See [LICENSE](LICENSE).

The data the app displays stays under its own licences: Statistics Canada Open Licence (2021 Census); City of Guelph Open Government Licence; © OpenStreetMap contributors (ODbL).
