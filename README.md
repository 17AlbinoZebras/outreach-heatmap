# Patient Heatmap

A frontend-only web application for visualizing the geographic distribution of proton therapy referral activity across Florida, centered on a generated target hospital. The map displays where referring doctors and referred patients are located, with choropleth shading by region and a range of display and filtering options.

## Tech Stack

- **Framework**: Next.js (App Router) + TypeScript
- **Map**: React-Leaflet + Leaflet, with MarkerCluster for hospital markers
- **UI components**: Radix UI (sliders, popovers), FontAwesome icons
- **Styling**: CSS Modules

## Data

All data is loaded client-side from static files in `public/`. No backend or API is required at runtime.

| File | Contents |
|------|----------|
| `public/boundaries/distances/counties_dist.geojson` | Florida county polygons with pre-computed distances from the target hospital |
| `public/boundaries/distances/states_dist.geojson` | State polygons with distances |
| `public/boundaries/distances/zip_codes_dist.geojson` | Zip code tabulation area polygons with distances |
| Patient / doctor JSON files | Geocoded records with address, coordinates, and county assignment |
| Referral JSON | Records linking doctor IDs to patient IDs with consult dates |
| Cancer rate data | Estimated proton-eligible cancer cases by county and cancer type |
| Population data | Population by state, county, and zip code |

### GeoJSON Preprocessing

The boundary files with distance fields are generated from shapefiles using `ogr2ogr` and `geopandas`. Converting shapefiles to GeoJSON:

```bash
ogr2ogr -f GeoJSON output.geojson input.shp -t_srs "OGC:CRS84"
```

Adding distance from the target hospital to each region centroid is handled by `public/boundaries/distances/compute_boundary_distances.py`.

County assignment for patient/doctor records is done with a `geopandas` spatial join (`sjoin`) before the data is exported to JSON.

## Running the App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Map Features

### Zoom-based region switching
- **State level** (`zoom < 7`): state choropleth
- **County level** (`zoom 7–8`): county choropleth + county labels
- **Zip code level** (`zoom ≥ 9`): zip code choropleth + county outline overlay

### Display modes

Toggle between **Doctors**, **Patients**, and **Referrals** using the pill buttons above the map. Each group has its own color ramp.

**Values by:**
- *Total count* — number of unique patients, doctors, or referrals in each region
- *Per capita* — count per 100,000 population

### Filters (sidebar)

The sidebar is collapsible — click the chevron button on the left edge of the map to hide or show it.

| Filter | Description |
|--------|-------------|
| Date range | Slider to limit counts to referrals within a date window. A lock icon preserves the selected window width while dragging. |
| Longitudinal analysis | Compare counts between two non-overlapping time periods. The map shows percentage change; sliders have snap-resistance at the boundary. |
<!-- | Cancer type | Available when the Cancer Estimates group is active; filters to a specific cancer type. | -->

### Map markers

A star marker identifies the target hospital on the map. Clicking it opens a popup with the facility name and county.

### Color legend

A legend in the header bar shows the current color scale, labeled with the active group (Patients, Referrals, or Doctors) and whether per-capita normalization is on.

### Region interaction

Hovering a region highlights its border. Clicking a region opens a popup and keeps the region highlighted with a dark border until it is clicked again to deselect.

**Popup contents:**
- Region name, display count, population, and rate per 100k
- When longitudinal analysis is active: Period 1 and Period 2 raw counts with correct unit labels (e.g. "1 patient" vs "3 patients", "1 referral" vs "5 referrals"). Missing values display as 0.

### Region rankings

A panel in the top-right corner of the map lists ranked regions or doctors at the current zoom level. The top-ranked entries are outlined in green on the map.

**Patients / Doctors mode:** ranks regions by count. Only regions with at least one doctor are included.

**Referrals mode:** ranks individual referring doctors by number of referrals. When a region is clicked on the map, the list narrows to doctors in that region only.

**Longitudinal analysis:** when active, both a "Top N" and "Worst N" list are shown. Clicking a row expands it to show Period 1 and Period 2 counts with unit labels; clicking anywhere on the expanded row collapses it.

**County abbreviations key:** at county zoom level, doctor names include a 3-letter county code in parentheses. A question-mark button in the rankings panel reveals a hover popup that decodes every abbreviation currently visible.

**Referrals mode address:** hovering over a doctor row reveals their full address (street on the first line, city/state/zip below). A copy button copies the full single-line address to the clipboard, with a brief "Copied!" confirmation.

## Project Structure

```
src/app/
├── page.tsx            # Root component — state, derived values, layout
├── map.tsx             # Leaflet map, ZoomAwareGeoJSON, choropleth logic
├── boundary.tsx        # Sidebar filters, color legend, toggle buttons
├── hospitalMetrics.tsx # Region rankings, radius-based counts
├── model.ts            # Data model classes (Model, Doctor, Patient, Hospital)
├── dataParsing.ts      # Builds counts, populations, cancer rates from raw records
├── jsonParsing.ts      # Loads and parses JSON data files
└── home_functions.ts   # Color ramps, threshold computation, display value calculation
```
