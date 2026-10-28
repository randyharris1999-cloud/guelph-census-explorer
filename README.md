# Guelph Census Explorer

Explore the 2021 Census across Guelph's 201 neighbourhoods (Statistics Canada dissemination areas).

- **Map any of 40 measures** across people, background, education and work, income, housing, commuting and access, with natural breaks (Jenks), quantile or equal-interval classes, 4 to 7 classes.
- **Neighbourhood profiles.** Tap a neighbourhood to see every measure beside the city figure, with a strip showing where it ranks among all 201.
- **Compare two neighbourhoods** side by side, with the difference for each measure.
- **See how two measures relate.** A scatter plot of any two measures with the correlation (r) explained in plain language. Tap a dot to open that neighbourhood.
- **Highest and lowest** five neighbourhoods for the mapped measure.
- **Find any address or street.** Search all 55,873 Guelph civic addresses: the app marks the address and opens its neighbourhood. Each neighbourhood is named after the two streets with the most length inside it.
- **City boundary** drawn from the City of Guelph's official boundary, with the area outside it faded.

A sister app to [15-Minute Guelph](https://github.com/randyharris1999-cloud/15-Minute-Guelph). It includes that app's 15-minute score for each neighbourhood.

## What's in the folder

| Path | What it is |
|---|---|
| `index.html` | The app |
| `leaflet.min.js` | Leaflet 1.9.4 map library |
| `data/explorer.json` | Neighbourhood polygons, census values, city boundary, street names, water and main roads |
| `data/addresses.json` | Every civic address with its neighbourhood, loaded after the map so the page opens quickly |
| `scripts/build_explorer.py` | Builds both data files from the Census extract, `City_Boundary.geojson` and the 15-Minute Guelph `data/` folder |
| `scripts/index.src.html` | App source |
| `scripts/build_html.py` | Inlines the Leaflet stylesheet and writes `index.html` |


## Data

| Data | Source |
|---|---|
| Population, age, income, low income, housing, commuting | Statistics Canada, 2021 Census of Population, dissemination areas (Statistics Canada Open Licence) |
| Addresses, city boundary, streets, water, neighbourhood names | City of Guelph Open Data |
| 15-minute score | 15-Minute Guelph |

Notes:

- Incomes are for 2020, when pandemic benefits raised some low incomes.
- City figures are Statistics Canada's own figures for the City of Guelph census subdivision.
- Most measures beyond population, age, households and income come from the 25% long-form sample, so small neighbourhoods can vary a lot.
- Work and commuting figures describe May 2021, during the pandemic.
- The app maps the 201 DAs that contain Guelph address points. The 19 others are mostly rural edges outside the city's address data.
- Values Statistics Canada suppressed for privacy appear as "Not reported".

An independent project built on open data. Not an official City of Guelph service. Created by Randy Harris.
