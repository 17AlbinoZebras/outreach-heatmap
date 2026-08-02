import csv
import json

CANCER_TYPES = [
    "AllCancers",
    "LungAndBronchus",
    "Prostate",
    "Breast",
    "Colorectal",
    "Bladder",
    "HeadAndNeck",
    "NonHodgkin",
    "Melanoma",
    "Ovary",
    "Cervix",]

RATES = {
    "AllCancers": 0.15,
    "LungAndBronchus": 0.175,
    "Prostate": 0.30,
    "Breast": 0.175,
    "Colorectal": 0.035,
    "Bladder": 0.075,
    "HeadAndNeck": 0.50,
    "NonHodgkin": 0.125,
    "Melanoma": 0.04,
    "Ovary": 0.015,
    "Cervix": 0.15,
}

def estimate_cancer_by_county(cancer_csv: str, population_json: str, output_path: str):
    with open(population_json) as f:
        pop_data = json.load(f)
    county_pop = pop_data['counties']['FL']

    results = []

    with open(cancer_csv, encoding='utf-8-sig') as f:
        for i in range(4):
            next(f)  # skip headers and full state row
        reader = csv.reader(f)
        for row in reader:
            county = row[0].strip() + " County"
            if not county:
                continue
            rates = {}
            normalized_rates = {}
            for i, cancer in enumerate(CANCER_TYPES):
                val = row[1 + i * 3]
                cancer_rate = (float(row[1 + i * 3]) * county_pop[county] / 100000) if val != '^' else 0
                rates[cancer] = cancer_rate
                normalized_rates[cancer] = cancer_rate * RATES[cancer]

            print(county, rates)

            results.append({ 'county': ("FL" + county), 'cancerRates': rates, 'protonEligible': normalized_rates })

    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)

estimate_cancer_by_county('data_parsing/cancer_estimates/cancer_data_cleaned.csv', 'data_parsing/population_data/region_populations_new.json', 'data_parsing/cancer_estimates/county_cancer_estimates.json')