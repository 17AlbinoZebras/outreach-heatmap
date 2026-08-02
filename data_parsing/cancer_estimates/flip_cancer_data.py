import json


cancerTypes = ["AllCancers", "LungAndBronchus", "Prostate", "Breast", "Colorectal", "Bladder", "HeadAndNeck", "NonHodgkin", "Melanoma", "Ovary", "Cervix"]
def flip_json_structure(input_file, output_file):
    swapped_order = {'cancerRates': {type: {} for type in cancerTypes}, 'protonEligible': {type: {} for type in cancerTypes}}
    with open(input_file, "r") as file:
        data = json.load(file, parse_constant=lambda x: None)

    for item in data:
        for cancerType in cancerTypes:
            swapped_order['cancerRates'][cancerType][item.get('county')] = item.get('cancerRates').get(cancerType)
            swapped_order['protonEligible'][cancerType][item.get('county')] = item.get('protonEligible').get(cancerType)

    with open(output_file, 'w') as f:
        json.dump(swapped_order, f, indent=2)

flip_json_structure('data_parsing/cancer_estimates/county_cancer_estimates_by_county.json', 'data_parsing/cancer_estimates/county_cancer_estimates_by_cancer_type.json')