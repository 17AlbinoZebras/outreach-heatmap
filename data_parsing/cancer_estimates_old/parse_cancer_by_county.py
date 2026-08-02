import csv
import json

# Age-specific proton-eligible rates per 100,000 (from our earlier estimates)
# Weighted averages for the two buckets:
RATES = {
    # Clinical practice estimates
    'under_50': 15,    # weighted avg of <20 (19), 20-34 (3), 35-44 (15), 45-54 (44)
    'over_50':  190,   # weighted avg of 55-64 (128), 65-74 (230), 75+ (209)
}

def estimate_cancer_by_county(hdpulse_csv: str, population_json: str, output_path: str):
    # Load county populations
    with open(population_json) as f:
        pop_data = json.load(f)
    county_pop = pop_data['counties']

    results = {}

    with open(hdpulse_csv, encoding='utf-8-sig') as f:
        for _ in range(4):
            next(f)
        reader = csv.DictReader(f)
        for row in reader:
            name = row['County'].strip()
            if not row.get('FIPS'):
                continue
            fips = row['FIPS'].strip()
            # ... rest of your logic

            # Skip US total and state rows
            if fips == '0' or fips.endswith('000'):
                continue

            people_50_plus = int(row['People (Age 50 And Over)'].replace(',', ''))
            total_pop = county_pop.get(name, 0)

            if total_pop == 0:
                continue

            people_under_50 = max(total_pop - people_50_plus, 0)

            estimated_cases = (
                (people_under_50 / 100_000) * RATES['under_50'] +
                (people_50_plus / 100_000) * RATES['over_50']
            )

            results[name] = {
                'fips': fips,
                'total_pop': total_pop,
                'pop_50_plus': people_50_plus,
                'pop_under_50': people_under_50,
                'estimated_proton_eligible': round(estimated_cases, 1),
                'rate_per_100k': round(estimated_cases / total_pop * 100_000, 1),
            }

    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)

estimate_cancer_by_county('data_parsing/HDPulse_data_export.csv', 'data_parsing/region_populations.json', 'data_parsing/county_cancer_estimates.json')