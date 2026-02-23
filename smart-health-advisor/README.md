# 💊 Smart Prescription AI

> An intelligent, ML-powered medicine recommendation system that suggests the safest and most suitable medications based on a patient's symptoms, age, and gender — using **TF-IDF vectorisation + Cosine Similarity** (scikit-learn).

---

## 📌 Problem Statement

Selecting the right medicine for a patient's symptoms is a complex, knowledge-intensive task. Junior healthcare workers, pharmacists in under-resourced settings, or students studying clinical pharmacology often lack instant access to a decision-support tool. This project simulates an AI-driven prescription assistant that:

- Accepts patient demographics and reported symptoms
- Matches them against a curated medical dataset using a real ML model
- Returns ranked medicine recommendations with safety scores, dosage, and warnings

---

## 🎥 Demo

| Patient Form | ML Results |
|---|---|
| Fill in name, age, gender, and symptoms | Medicines ranked by cosine similarity score |
| Green **"ML Backend Online"** badge confirms the model is active | Each card shows safety score + `XX.X% match` from TF-IDF |

---

## 🧠 How the ML Model Works

### Algorithm: TF-IDF + Cosine Similarity

This is a classic **Information Retrieval** technique repurposed for medical matching:

#### Step 1 — Build the Corpus
Each medicine in the dataset becomes a **document**. All symptoms associated with that medicine across every patient case are concatenated into one text string.

```
Paracetamol  →  "Headache Fatigue Fever Fever Cough Headache Fatigue"
Ibuprofen    →  "Back pain Limited movement Joint pain Swelling Acute severe pain post-op"
Amoxicillin  →  "Severe sore throat Difficulty swallowing High fever Severe cough ..."
```

#### Step 2 — TF-IDF Vectorisation
Using **scikit-learn's `TfidfVectorizer`**, each medicine document is converted into a numerical vector in a high-dimensional feature space (157 features in our model).

- **TF (Term Frequency):** How often a symptom appears for this medicine
- **IDF (Inverse Document Frequency):** Penalises symptoms that appear across all medicines (not discriminative)
- **Sublinear TF scaling** (`sublinear_tf=True`): Uses `1 + log(TF)` to dampen very frequent terms
- **Bigrams** (`ngram_range=(1,2)`): Captures multi-word symptoms like *"sore throat"*, *"back pain"*

```
TF-IDF Matrix shape: (17 medicines) × (157 features)
```

#### Step 3 — Query Vectorisation
The patient's reported symptoms (e.g. `["Fever", "Headache", "Fatigue"]`) are joined into a single query string and transformed using the **same fitted vectorizer** — projecting them into the same 157-dimensional space.

#### Step 4 — Cosine Similarity
For each medicine vector **m** and the query vector **q**:

```
cosine_similarity(q, m) = (q · m) / (||q|| × ||m||)
```

This measures the **angle** between the two vectors — a score of `1.0` means perfect alignment, `0.0` means no overlap.

#### Step 5 — Ranking & Deduplication
- Medicines are ranked by cosine similarity (descending)
- Duplicate variants (e.g. "Amoxicillin" vs "Amoxicillin (or amoxicillin-clavulanate depending)") are deduplicated by normalised base name
- Top 5 results are returned

#### Step 6 — Safety Scoring
A supplementary heuristic safety score (50–100) is computed from the risk factors column, penalising contraindications like kidney disease, liver impairment, anticoagulant interactions, and pregnancy risks.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     User's Browser                      │
│                                                         │
│   ┌──────────────────────────────────────────────────┐  │
│   │           React Frontend  (Vite + TS)            │  │
│   │                                                  │  │
│   │  PatientIntakeForm  ──►  recommendationEngine.ts │  │
│   │                               │                  │  │
│   │                    ┌──────────┴──────────┐       │  │
│   │                    ▼                     ▼       │  │
│   │            HTTP POST /api/recommend   fallback   │  │
│   │            (fetch with 8s timeout)  local JS     │  │
│   └────────────────────┬─────────────────────────────┘  │
└────────────────────────│────────────────────────────────┘
                         │
         ┌───────────────▼──────────────────┐
         │     Flask Backend  (Python)       │
         │         localhost:5000            │
         │                                  │
         │  ┌────────────────────────────┐  │
         │  │  TfidfVectorizer (fitted)  │  │
         │  │  tfidf_matrix: 17 × 157    │  │
         │  └────────────┬───────────────┘  │
         │               │                  │
         │  query_vec ──►│ cosine_similarity │
         │               │                  │
         │  ┌────────────▼───────────────┐  │
         │  │  Ranked Recommendations    │  │
         │  │  + Safety Score Heuristic  │  │
         │  └────────────────────────────┘  │
         │                                  │
         │  Source: medication_dataset.csv  │
         └──────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
drug_pres/
│
├── backend/                          # Python ML backend
│   ├── app.py                        # Flask API server
│   └── requirements.txt              # Python dependencies
│
└── smart-health-advisor/             # React frontend (this repo)
    ├── public/
    │   └── data/
    │       └── medication_dataset.csv  # Training corpus (61 patient cases)
    │
    ├── src/
    │   ├── components/
    │   │   ├── PatientIntakeForm.tsx   # Patient data input form
    │   │   └── MedicineRecommendation.tsx  # Results display with similarity badges
    │   │
    │   ├── lib/
    │   │   └── recommendationEngine.ts  # ML backend client + local fallback
    │   │
    │   └── pages/
    │       ├── Index.tsx              # Main page with ML status badge
    │       └── DataLoader.tsx         # Dataset explorer page
    │
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **TypeScript** | Type-safe JavaScript |
| **Vite** | Fast dev server & bundler |
| **shadcn/ui** | Component library (Radix UI + Tailwind CSS) |
| **React Router v6** | Client-side routing |
| **Lucide React** | Icons |

### Backend (ML Engine)
| Technology | Purpose |
|---|---|
| **Python 3.12** | Backend language |
| **Flask 3** | Lightweight REST API framework |
| **Flask-CORS** | Cross-origin request handling |
| **scikit-learn** | `TfidfVectorizer` + `cosine_similarity` |
| **pandas** | CSV loading and groupby aggregation |
| **NumPy** | Matrix operations and argsort |

---

## 📊 Dataset

**File:** `public/data/medication_dataset.csv`  
**Size:** 61 patient cases, 17 unique medicines

### Columns

| Column | Description |
|---|---|
| `Name` | Patient name (anonymised) |
| `DateOfBirth` | Patient date of birth |
| `Gender` | Male / Female |
| `Symptoms` | Comma-separated symptom list |
| `Causes` | Underlying cause |
| `Disease` | Diagnosed condition |
| `Medicine` | Recommended medicine |
| `RiskFactors` | Contraindications and warnings |
| `SourceReference` | Medical guideline source (WHO, NICE, etc.) |

### Medicines Covered

| Medicine | Conditions |
|---|---|
| Paracetamol | Tension headache, common cold, fever |
| Ibuprofen | Back pain, osteoarthritis, post-op pain |
| Amoxicillin | Tonsillitis, pneumonia, pharyngitis |
| Amoxicillin-clavulanate | Cellulitis |
| Nitrofurantoin | UTI |
| Omeprazole | GERD, peptic symptoms, gastritis |
| Metformin | Type 2 diabetes |
| Sumatriptan | Migraine |
| Sertraline | Depression |
| Lisinopril | Hypertension, ischemic heart disease |
| Albuterol (Salbutamol) inhaler | Asthma, exercise-induced bronchospasm |
| Beta-blocker (Propranolol) | SVT, anxiety |
| Topical chloramphenicol | Conjunctivitis |
| Flucloxacillin | Cellulitis |
| Epinephrine (IM) | Anaphylaxis |

---

## ⚙️ Getting Started

### Prerequisites
- **Node.js** v18+ and npm
- **Python** 3.10+

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd drug_pres
```

### 2. Set up the Python backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```
The backend will start at **http://localhost:5000**  
You'll see:
```
Loading medication dataset …
Building TF-IDF matrix for 17 unique medicines …
TF-IDF matrix shape: (17, 157)
Backend ready ✓
```

### 3. Set up the React frontend
Open a **new terminal**:
```bash
cd smart-health-advisor
npm install
npm run dev
```
The frontend starts at **http://localhost:8080**

### 4. Open the app
Navigate to **http://localhost:8080** in your browser.  
You should see the green **"ML Backend Online"** badge in the header.

---

## 🔌 API Reference

### `GET /api/health`
Returns the backend status and model metadata.

**Response:**
```json
{
  "status": "ok",
  "medicines": 17,
  "tfidf_features": 157
}
```

### `POST /api/recommend`
Returns medicine recommendations for a patient.

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
  "disclaimer": "...",
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

If the Python backend is not running, the frontend **automatically switches** to a local JavaScript keyword-matching engine — with zero configuration needed. The UI shows a yellow **"Local Fallback"** badge instead of the green ML one.

```
Frontend starts
     │
     ▼
Probe GET /api/health  ──── timeout/error ──►  Use local JS engine
     │                                               │
     │ 200 OK                               (keyword overlap scoring)
     ▼
Use ML backend (TF-IDF)
```

---

## 📈 Key ML Concepts Explained (for Presentation)

### Why TF-IDF?
- Raw word counts favour medicines with many common symptoms
- TF-IDF **down-weights** generic terms (e.g. "pain") that appear in many medicines
- It **up-weights** discriminative terms (e.g. "polyuria", "wheeze") that uniquely identify a condition

### Why Cosine Similarity?
- We care about the **direction** of the symptom vectors, not their magnitude
- A patient with "Headache, Fatigue" should match "Headache, Fatigue, Fever" more than a document that just repeats "Headache" 100 times
- Cosine similarity is immune to document length differences

### Why bigrams?
- `ngram_range=(1, 2)` captures multi-word symptoms
- "sore throat" as a bigram is more meaningful than "sore" and "throat" separately
- Improves matching precision significantly for compound symptom descriptions

---

## 🚧 Limitations & Future Work

| Limitation | Potential Improvement |
|---|---|
| Small dataset (61 cases) | Train on larger open medical datasets (e.g. MIMIC-III) |
| No drug interaction checking | Integrate a drug interaction API (e.g. openFDA) |
| No user authentication | Add patient login to track prescription history |
| Safety score is heuristic | Replace with evidence-based contraindication database |
| No dosage personalisation | Factor in weight, renal/hepatic function for dosing |
| English symptoms only | Add multilingual support |

---

## ⚠️ Medical Disclaimer

> This application is developed for **educational and demonstration purposes only**. The recommendations generated by this system are produced by a machine learning model trained on a small sample dataset and are **not validated for clinical use**. Always consult a licensed and qualified healthcare professional before taking any medication. The authors accept no liability for medical decisions made based on this tool.

---

## 👨‍💻 Author

**Somesh Sisodia**  
Final Year B.Tech — Computer Science  

---

## 📄 License

This project is for academic/educational use only.
