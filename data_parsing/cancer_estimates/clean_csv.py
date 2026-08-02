import csv

with open('data_parsing/FloridaCancerByCounty.csv', encoding='utf-8-sig') as f:
    lines = f.readlines()

cleaned = []
for line in lines:
    row = line.split(',')
    cleaned_row = [cell for cell in row if cell.strip() != '']
    cleaned.append(','.join(cleaned_row))

with open('data_parsing/cancer_data_cleaned.csv', 'w') as f:
    f.write('\n'.join(cleaned))