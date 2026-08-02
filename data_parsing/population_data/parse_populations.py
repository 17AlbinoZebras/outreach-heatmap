import csv
import json

FIPS_TO_STATE = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
    "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
    "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
    "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
    "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
    "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
    "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
    "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
    "56": "WY", "72": "PR",
}

def build_population_map(census_csv_path: str, output_path: str):
    county_pop = {}
    state_pop = {}
    state_county_pop = {}
    state_abbr = ""

    with open(census_csv_path, encoding='latin-1') as f:
        reader = csv.DictReader(f)
        for row in reader:
            county = row['CTYNAME']
            population = int(row['POPESTIMATE2025'])  # adjust column name to match your CSV

            if int(row['COUNTY']) == 0:
                state_county_pop[state_abbr] = county_pop
                county_pop = {}
                state_abbr = FIPS_TO_STATE.get(row['STATE'].zfill(2), row['STATE'])
                state_pop[state_abbr] = population
            else:
                county_pop[county] = population

            # if state_abbr in state_pop:
            #     state_pop[state_abbr] += population
            # else:
            #     state_pop[state_abbr] = population
        
        state_county_pop[state_abbr] = county_pop
        del state_county_pop[""]

    output = {
        'counties': state_county_pop,
        'states': state_pop,
    }

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

build_population_map("data_parsing/co-est2025-alldata.csv", "data_parsing/region_populations_new.json")