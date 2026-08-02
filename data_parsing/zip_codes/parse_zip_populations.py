import csv
import json

def parse_zip_populations(census_csv_path: str, output_path: str):
    zip_pop = {}

    with open(census_csv_path, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        
        headers = next(reader)
        print(headers)

        for row in reader:
            zip = row['name']
            population = int(row['population'])

            zip_pop[zip] = population

    output = {
        'zips': zip_pop,
    }

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

parse_zip_populations("data_parsing/zip_codes/Florida_DemographicsByZipCode_sample.csv", "data_parsing/population_data/zip_populations.json")