# Medication Dataset Guide

## Overview

The app uses a local CSV file located at `public/data/medication_dataset.csv`. No cloud database or external API is required.

## CSV Format

| Column          | Description                                    |
|-----------------|------------------------------------------------|
| Name            | Patient name (anonymised)                      |
| DateOfBirth     | Patient date of birth                          |
| Gender          | Male / Female                                  |
| Symptoms        | Comma-separated symptoms                       |
| Causes          | Underlying cause of the condition              |
| Disease         | Diagnosed condition                            |
| Medicine        | Recommended medicine                           |
| RiskFactors     | Contraindications and warnings                 |
| SourceReference | Medical guideline source                       |

## Adding More Medicines

Simply append new rows to `public/data/medication_dataset.csv` following the format above. The recommendation engine will automatically pick up the new entries on the next page load — no rebuild required.

## How Recommendations Work

1. The CSV is fetched from `/data/medication_dataset.csv` at runtime.
2. Unique medicines are extracted and their symptoms aggregated across all rows.
3. The patient's reported symptoms are matched against each medicine's known symptom list using keyword overlap.
4. A safety score (50–100) is computed from the risk factors column.
5. The top 5 matches by (match count, safety score) are returned as recommendations.

## Disclaimer

The dataset is for educational and demonstration purposes. All clinical decisions must be made by a qualified healthcare professional.
