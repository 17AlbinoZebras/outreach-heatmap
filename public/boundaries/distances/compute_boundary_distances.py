import geopandas as gpd

from shapely.geometry import Point

target_lat, target_lon = 26.439492, -80.0950317

target = gpd.GeoSeries(
    [Point(target_lon, target_lat)], crs='EPSG:4326'
).to_crs('EPSG:3857').iloc[0]

def add_distances(input_path, output_path):
    gdf = gpd.read_file(input_path).to_crs('EPSG:3857')
    gdf['dist_miles'] = gdf.geometry.centroid.distance(target) / 1609.34
    gdf.to_crs('EPSG:4326').to_file(output_path, driver='GeoJSON')

add_distances('public/boundaries/states.geojson',  'public/boundaries/distances/states_dist.geojson')
add_distances('public/boundaries/counties.geojson', 'public/boundaries/distances/counties_dist.geojson')
add_distances('public/boundaries/zip_codes.geojson',    'public/boundaries/distances/zip_codes_dist.geojson')