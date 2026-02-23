# 💊 Smart Prescription AI

> An intelligent, ML-powered medicine recommendation system that suggests the safest and most suitable medications based on a patient's symptoms, age, and gender — powered by **TF-IDF vectorisation + Cosine Similarity** (scikit-learn Python backend) with a React + TypeScript frontend.

---

## 📌 Problem Statement

Selecting the right medicine for a patient's symptoms is a complex, knowledge-intensive task. Junior healthcare workers, pharmacists in under-resourced settings, or students studying clinical pharmacology often lack instant access to a decision-support tool.

This project simulates an AI-driven prescription assistant that:

- Accepts patient demographics (name, age, gender) and reported symptoms
- Matches them against a curated medical dataset using a real ML model
- Returns ranked medicine recommendations with safety scores, dosage information, and warnings
- Explains **why** each medicine was recommended (model transparency)

---

## 🎥 Features

- ✅ **Real ML Model** — TF-IDF + Cosine Similarity via scikit-learn (not rule-based)
- ✅ **Cosine Similarity Score** — each recommendation shows its similarity percentage (e.g. `77.7% match`)
- ✅ **Safety Score** — computed from contraindications and risk factors in the dataset (0–100)
- ✅ **Dosage Information** — mapped from WHO and NICE medical guidelines
- ✅ **Smart Fallback** — if Python backend is offline, automatically switches to local JS engine; no crash
- ✅ **Backend Status Badge** — green "ML Backend Online" / yellow "Local Fallback" shown in the UI
- ✅ **Dataset Explorer** — `/load-data` page shows all 17 medicines and their conditions
- ✅ **Custom Symptoms** — patients can type in symptoms not on the default list

---

## 🧠 How the ML Model Works

### Algorithm: TF-IDF + Cosine Similarity

#### Step 1 — Build the Corpus

Each medicine in the dataset is treated as a **document**. All symptom strings across every patient case for that medicine are concatenated into one text:

```
Paracetamol  →  "Headache Fatigue Fever Cough Headache Fatigue"
Ibuprofen    →  "Back pain Limited movement Joint pain Swelling Acute severe pain"
Amoxicillin  →  "Severe sore throat Difficulty swallowing High fever Severe cough"
```

#### Step 2 — TF-IDF Vectorisation (scikit-learn)

Using `TfidfVectorizer`, each medicine document is converted into a numerical vector:

- **TF (Term Frequency):** How often a symptom appears for this medicine
- **IDF (Inverse Document Frequency):** Penalises symptoms common to many medicines (e.g. "pain")
- **Sublinear TF scaling** (`sublinear_tf=True`): Uses `1 + log(TF)` to dampen very frequent terms
- **Bigrams** (`ngram_range=(1,2)`): Captures multi-word symptoms like *"sore throat"*, *"back pain"*

```
Resulting TF-IDF Matrix: (17 medicines) × (157 features)
```

#### Step 3 — Query Vectorisation

The patient's symptoms (e.g. `["Fever", "Headache", "Fatigue"]`) are joined into a string and transformed using the **same fitted vectorizer** — placing them into the same 157-dimensional space.

#### Step 4 — Cosine Similarity

For each medicine vector **m** and the patient query vector **q**:

```
cosine_similarity(q, m) = (q · m) / (||q|| × ||m||)
```

- **1.0** = perfect symptom alignment
- **0.0** = no overlap at all

Medicines are ranked by this score — the higher the angle, the better the match.

#### Step 5 — Safety Scoring (Heuristic Layer)

On top of the ML ranking, a safety score (50–100) is computed from the risk factors column:

| Risk Factor in Data | Safety Penalty |
|---|---|
| Bleeding disorder | −8 points |
| Kidney / Renal disease | −7 points |
| Liver / Hepatic disease | −7 points |
| Anticoagulant interaction | −6 points |
| Elderly patient | −5 points |
| Pregnancy warning | −5 points |
| Contraindication / Avoid | −4 points |
| OTC safe medicines (Paracetamol etc.) | +10 points |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        User's Browser                        │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐   │
│   │              React Frontend  (Vite + TypeScript)     │   │
│   │                                                      │   │
│   │   PatientIntakeForm  ──►  recommendationEngine.ts    │   │
│   │                                  │                   │   │
│   │                      ┌───────────┴───────────┐       │   │
│   │                      ▼                       ▼       │   │
│   │           POST /api/recommend           fallback     │   │
│   │           (8s timeout)             local JS engine   │   │
│   └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────│──────────────────────────────────┘
                           │  HTTP
          ┌────────────────▼────────────────────┐
          │      Flask Backend  (Python 3.12)    │
          │          localhost:5000              │
          │                                     │
          │  On startup:                        │
          │   1. Load medication_dataset.csv    │
          │   2. groupby("Medicine")            │
          │   3. Fit TfidfVectorizer            │
          │   4. Build tfidf_matrix (17×157)    │
          │                                     │
          │  On every request:                  │
          │   1. Transform query symptoms       │
          │   2. cosine_similarity(q, matrix)   │
          │   3. argsort descending             │
          │   4. Deduplicate + safety score     │
          │   5. Return top 5 as JSON           │
          └─────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
drug_pres/
│
├── README.md                            ← You are here
├── PRESENTATION_NOTES.txt               ← Full presentation talking points
│
├── backend/                             ← Python ML backend
│   ├── app.py                           ← Flask API + TF-IDF model
│   └── requirements.txt                 ← Python dependencies
│
└── smart-health-advisor/                ← React + TypeScript frontend
    │
    ├── public/
    │   └── data/
    │       └── medication_dataset.csv   ← 61 patient cases, 17 medicines
    │
    ├── src/
    │   ├── components/
    │   │   ├── PatientIntakeForm.tsx     ← Patient data input UI
    │   │   └── MedicineRecommendation.tsx ← Results with similarity badges
    │   │
    │   ├── lib/
    │   │   └── recommendationEngine.ts  ← ML backend client + JS fallback
    │   │
    │   └── pages/
    │       ├── Index.tsx                ← Main page (form + results)
    │       └── DataLoader.tsx           ← Dataset explorer (/load-data)
    │
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

---

## 🛠️ Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5.8 | Type-safe JavaScript |
| Vite | 5.4 | Dev server & bundler |
| shadcn/ui | latest | Component library (Radix UI) |
| Tailwind CSS | 3.4 | Utility-first CSS |
| React Router | v6 | Client-side routing |
| Lucide React | 0.462 | Icon set |
| TanStack Query | v5 | Server state management |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.12 | Backend language |
| Flask | 3.1 | REST API framework |
| Flask-CORS | 6.0 | CORS for React dev server |
| scikit-learn | ≥1.4 | TfidfVectorizer + cosine_similarity |
| pandas | ≥2.1 | CSV loading, groupby aggregation |
| NumPy | ≥1.26 | Matrix operations, argsort |

---

## 📊 Dataset

**Path:** `smart-health-advisor/public/data/medication_dataset.csv`
**Size:** 61 patient cases | 17 unique medicines | 9 columns

### Column Reference

| Column | Description |
|---|---|
| `Name` | Patient name (anonymised) |
| `DateOfBirth` | Patient date of birth |
| `Gender` | Male / Female |
| `Symptoms` | Comma-separated reported symptoms |
| `Causes` | Underlying cause of the condition |
| `Disease` | Diagnosed condition |
| `Medicine` | Recommended medicine |
| `RiskFactors` | Contraindications and patient warnings |
| `SourceReference` | Medical guideline citation |

### Medicines in Dataset

| Medicine | Conditions Treated |
|---|---|
| Paracetamol | Tension headache, common cold, fever |
| Ibuprofen / NSAID | Back pain, osteoarthritis, post-op pain, plantar fasciitis |
| Amoxicillin | Tonsillitis, community-acquired pneumonia, pharyngitis |
| Amoxicillin-clavulanate | Cellulitis |
| Nitrofurantoin | Urinary tract infection (UTI) |
| Omeprazole | GERD, gastritis, peptic symptoms, dyspepsia |
| Metformin | Type 2 Diabetes |
| Sumatriptan | Migraine, photophobia |
| Sertraline | Depression |
| Lisinopril | Hypertension, ischemic heart disease |
| Albuterol (Salbutamol) inhaler | Asthma, exercise-induced bronchospasm |
| Beta-blocker (Propranolol) | SVT, anxiety-related palpitations |
| Topical chloramphenicol eye drops | Bacterial conjunctivitis |
| Flucloxacillin | Cellulitis (skin infection) |
| Epinephrine IM | Anaphylaxis (emergency) |

**Sources:** WHO Model List of Essential Medicines (2023) · NICE UK Guidelines · StatPearls NCBI Bookshelf (2024)

---

## ⚙️ Getting Started

### Prerequisites

- **Node.js** v18 or later + npm
- **Python** 3.10 or later + pip

### Step 1 — Clone the repository

```bash
git clone <your-repo-url>
cd drug_pres
```

### Step 2 — Start the Python ML backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Expected output:
```
Loading medication dataset …
CSV columns: ['Name', 'DateOfBirth', 'Gender', 'Symptoms', ...]
Building TF-IDF matrix for 17 unique medicines …
TF-IDF matrix shape: (17, 157)
Backend ready ✓
 * Running on http://0.0.0.0:5000
```

### Step 3 — Start the React frontend

Open a **new terminal**:

```bash
cd smart-health-advisor
npm install
npm run dev
```

### Step 4 — Open the app

Go to **http://localhost:8080**

You should see a green **"ML Backend Online"** badge in the top-right corner of the header.

---

## 🔌 API Reference

### `GET /api/health`

Returns server status and model metadata.

```json
{
  "status": "ok",
  "medicines": 17,
  "tfidf_features": 157
}
```

### `POST /api/recommend`

Returns ranked medicine recommendations for a patient.

**Request body:**
```json
{
  "patientName": "John Doe",
  "age": 35,
  "gender": "male",
  "symptoms": ["Fever", "Headache", "Fatigue"]
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "medicine": "Paracetamol",
      "safetyScore": 93,
      "similarityScore": 0.777,
      "reason": "Matched via TF-IDF cosine similarity (77.7%). Commonly indicated for: Tension Headache, Common Cold.",
      "warnings": "No major warnings identified for typical adults.",
      "dosage": "500–1000 mg every 4–6 hours as needed (max 4 g/day)",
      "activeIngredients": ["Paracetamol"]
    }
  ],
  "disclaimer": "Recommendations generated by a TF-IDF cosine similarity model...",
  "model": {
    "name": "TF-IDF + Cosine Similarity",
    "library": "scikit-learn",
    "features": 157,
    "corpus": 17
  }
}
```

---

## 🔄 Fallback Mechanism

If the Python backend is not running, the frontend **automatically switches** to a local in-browser JavaScript keyword-matching engine — zero configuration needed.

```
App starts → probes GET /api/health (3s timeout)
                │
        ┌───────┴────────┐
        │ 200 OK         │ Timeout / Error
        ▼                ▼
  ML Backend        Local JS Engine
  (TF-IDF)          (keyword overlap)
  Green badge       Yellow badge
```

---

## 🚧 Limitations

| Limitation | Explanation |
|---|---|
| Small dataset (61 cases) | More data would significantly improve model accuracy |
| No drug interaction checking | Two medicines together could be dangerous; not handled |
| Safety score is heuristic | Hand-crafted formula, not clinically validated |
| No patient history | Doesn't know about existing allergies or conditions |
| English only | No multilingual support |
| No authentication | No login system; not suitable for production use |

---

## 🚀 Future Work

- Train on larger open medical datasets (e.g. MIMIC-III, openFDA)
- Replace TF-IDF with **BioMedBERT sentence embeddings** for semantic understanding
- Add **drug interaction checking** via openFDA API
- **Patient login** system to track prescription history
- **Dosage personalisation** based on patient weight and organ function
- Deploy on cloud (AWS / GCP / Azure) with a real database

---

## ⚠️ Medical Disclaimer

> This application is developed for **educational and demonstration purposes only**.
> The recommendations are produced by a machine learning model trained on a small sample dataset and are **not validated for clinical use**.
> Always consult a licensed and qualified healthcare professional before taking any medication.
> The authors accept no liability for any medical decisions made based on this tool.

---

## 👨‍💻 Author

**Somesh Sisodia**
Final Year B.Tech — Computer Science

---

## 📄 License

This project is for academic and educational use only.
