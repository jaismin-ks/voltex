# Voltex Local Datasets

This folder contains local static datasets used by the Voltex scoring backend. Large downloaded payloads are git-ignored; this manifest is kept in source control so the files can be refreshed or re-downloaded.

## Outage History Proxy

- Local CSVs: `datasets/outages/311-service-requests-customer-initiated/csv/<year>/SR<year>.csv`
- Raw ZIPs: `datasets/outages/311-service-requests-customer-initiated/zip/`
- Source: City of Toronto Open Data, `311 Service Requests - Customer Initiated`
- Source package: `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=311-service-requests-customer-initiated`
- Scoring use: proxy for historical outage/storm-response frequency by filtering forestry, tree, water, transportation, and severe-weather-adjacent requests.
- Notes: Toronto does not publish public utility outage-event logs. The 311 dataset is a public proxy and only includes validated customer-initiated requests from participating divisions.

## Tree Canopy / Vegetation Risk

- Local GeoJSON: `datasets/geo/toronto-street-tree-data-4326.geojson`
- Source: City of Toronto Open Data, `Street Tree Data`
- Source package: `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=street-tree-data`
- Scoring use: estimate vegetation density near a queried point or zone.
- Notes: WGS84 / EPSG:4326 was downloaded for direct use with Leaflet and backend geospatial checks.

## Flood Exposure

- Local GeoJSON: `datasets/geo/nrcan-floods-current-ontario-footprints.geojson`
- Local GeoJSON: `datasets/geo/nrcan-floods-archive-ontario-footprints.geojson`
- Source: Natural Resources Canada, `Floods in Canada - Current Year` and `Floods in Canada - Archive`
- Current package: `https://open.canada.ca/data/api/action/package_show?id=b1afd8d2-6e14-4ec4-9a09-652221a6cb71`
- Archive package: `https://open.canada.ca/data/api/action/package_show?id=74144824-206e-4cea-9fb9-72925a128189`
- Scoring use: point-in-polygon or nearby-footprint flood exposure proxy for Ontario.
- Notes: These are Ontario product footprints from NRCan emergency flood products, exported from ArcGIS REST as GeoJSON. They are not legal floodplain polygons.

## Metadata

- Local JSON metadata: `datasets/metadata/*.json`
- Includes package metadata for Toronto 311, Toronto street trees, Toronto forest/land cover, NRCan flood products, and Environment Canada city-page weather.
- Weather is not stored as a static dataset. The backend should fetch Environment Canada weather live per assessment request.

