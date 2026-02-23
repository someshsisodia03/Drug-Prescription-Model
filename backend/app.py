"""
Smart Prescription AI — Python Backend
TF-IDF + Cosine Similarity recommendation engine (scikit-learn)

Run:  python app.py
API:  http://localhost:5000
"""

import os
import re
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ─── App Setup ───────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)  # Allow requests from the React dev server

# ─── Dataset Path ────────────────────────────────────────────────────────────

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
# Checks same folder first (for Render deployment), then falls back to dev path
_local_csv = os.path.join(BASE_DIR, "medication_dataset.csv")
_dev_csv   = os.path.join(BASE_DIR, "..", "smart-health-advisor", "public", "data", "medication_dataset.csv")
CSV_PATH   = _local_csv if os.path.exists(_local_csv) else _dev_csv

# ─── Load & Preprocess Dataset ───────────────────────────────────────────────

print("Loading medication dataset …")
df = pd.read_csv(CSV_PATH)

# Normalise column names (strip whitespace)
df.columns = df.columns.str.strip()
print("CSV columns:", list(df.columns))

# Aggregate per medicine: join all symptom strings into one document
med_symptoms = (
    df.groupby("Medicine")["Symptoms"]
    .apply(lambda x: " ".join(x.dropna()))
    .reset_index()
)
med_symptoms.columns = ["medicine", "symptom_doc"]

# Aggregate diseases (unique, comma-separated) — keep column name "medicine" consistent
med_diseases = (
    df.groupby("Medicine")["Disease"]
    .apply(lambda x: ", ".join(x.dropna().unique()))
    .reset_index()
)
med_diseases.columns = ["medicine", "disease"]

# Aggregate risk factors (unique, semicolon-separated)
med_risks = (
    df.groupby("Medicine")["RiskFactors"]
    .apply(lambda x: "; ".join(x.dropna().unique()))
    .reset_index()
)
med_risks.columns = ["medicine", "risk_factors"]

# Merge into one lookup table (all use lowercase 'medicine' key now)
med_info = med_symptoms.merge(med_diseases, on="medicine", how="left")
med_info = med_info.merge(med_risks, on="medicine", how="left")
med_info.fillna("", inplace=True)

# ─── Build TF-IDF Matrix ─────────────────────────────────────────────────────

print(f"Building TF-IDF matrix for {len(med_info)} unique medicines …")

vectorizer = TfidfVectorizer(
    ngram_range=(1, 2),       # unigrams + bigrams capture "sore throat" etc.
    stop_words="english",
    min_df=1,
    sublinear_tf=True,        # log-scaled TF to dampen very frequent terms
)

tfidf_matrix = vectorizer.fit_transform(med_info["symptom_doc"])
print("TF-IDF matrix shape:", tfidf_matrix.shape)
print("Backend ready ✓\n")

# ─── Helpers ─────────────────────────────────────────────────────────────────

DOSAGE_MAP = {
    "ibuprofen":                        "200–400 mg every 6–8 hours with food (max 1200 mg/day OTC)",
    "paracetamol":                      "500–1000 mg every 4–6 hours as needed (max 4 g/day)",
    "amoxicillin":                      "250–500 mg three times daily for 5–7 days as prescribed",
    "amoxicillin-clavulanate":          "500/125 mg three times daily for 5–7 days as prescribed",
    "nitrofurantoin":                   "50–100 mg four times daily for 5–7 days (UTI)",
    "omeprazole":                       "20 mg once daily before a meal for 4–8 weeks",
    "metformin":                        "Start 500 mg twice daily with meals; titrate as prescribed",
    "sumatriptan":                      "50 mg at onset of migraine; may repeat after 2 h (max 200 mg/day)",
    "sertraline":                       "50 mg once daily; may be titrated to 200 mg/day",
    "lisinopril":                       "Start 5–10 mg once daily; adjust per blood pressure response",
    "albuterol":                        "1–2 puffs (100 mcg/puff) every 4–6 hours as needed",
    "salbutamol":                       "1–2 puffs (100 mcg/puff) every 4–6 hours as needed",
    "propranolol":                      "10–40 mg two to three times daily as prescribed",
    "chloramphenicol":                  "1–2 drops affected eye(s) every 2–6 hours for 5 days",
    "flucloxacillin":                   "250–500 mg four times daily as prescribed",
    "epinephrine":                      "0.3–0.5 mg intramuscularly in outer thigh (emergency use only)",
    # ── New medicines added with dataset expansion (v2) ──
    "cetirizine":                       "10 mg once daily; 5 mg once daily in elderly or renal impairment",
    "losartan":                         "Start 50 mg once daily; may increase to 100 mg once daily as prescribed",
}

def get_dosage(medicine_name: str) -> str:
    lower = medicine_name.lower()
    for key, value in DOSAGE_MAP.items():
        if key in lower:
            return value
    return "Consult a healthcare provider for appropriate dosage information."


def calculate_safety_score(risk_text: str, age: int) -> int:
    """Hand-crafted safety heuristic on top of TF-IDF results."""
    score = 100
    risk_lower = risk_text.lower()

    deductions = [
        ("bleeding",       8),
        ("kidney",         7),
        ("renal",          7),
        ("liver",          7),
        ("hepatic",        7),
        ("anticoagulant",  6),
        ("elderly",        5),
        ("pregnancy",      5),
        ("allergic to",    4),
        ("avoid",          3),
    ]
    for keyword, penalty in deductions:
        if keyword in risk_lower:
            score -= penalty

    # Count distinct risk phrases as additional penalty
    phrases = [p.strip() for p in risk_text.split(";") if p.strip()]
    score -= len(phrases) * 2

    # Age-specific bonus for very safe OTC medicines
    safe_meds_boost = ["paracetamol", "acetaminophen", "loratadine"]
    # (applied at call site where medicine name is known)

    return max(50, min(100, score))


def build_warnings(risk_text: str, age: int) -> str:
    parts = []
    risk_lower = risk_text.lower()
    if age >= 65 and "elderly" in risk_lower:
        parts.append("Dose reduction may be needed for elderly patients.")
    if "pregnancy" in risk_lower:
        parts.append("Use with caution during pregnancy.")
    if "anticoagulant" in risk_lower:
        parts.append("May interact with anticoagulant therapy — monitor closely.")
    if "kidney" in risk_lower or "renal" in risk_lower:
        parts.append("Use with caution in patients with kidney disease.")
    if "liver" in risk_lower or "hepatic" in risk_lower:
        parts.append("Dose adjustment required for liver impairment.")
    # Include any raw contraindications not captured above
    raw_phrases = [p.strip() for p in risk_text.split(";") if p.strip()]
    for phrase in raw_phrases:
        pl = phrase.lower()
        if "allergic" in pl or "avoid" in pl:
            parts.append(phrase)
    return " ".join(parts) if parts else "No major warnings identified for typical adults."


def normalise_name(name: str) -> str:
    """Strip parenthetical qualifiers for deduplication."""
    return re.sub(r"\s*\(.*?\)\s*", "", name).strip().lower()

# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "medicines": int(len(med_info)),
        "tfidf_features": int(tfidf_matrix.shape[1]),
    })


@app.route("/api/recommend", methods=["POST"])
def recommend():
    body         = request.get_json(force=True)
    symptoms     = body.get("symptoms", [])
    age          = int(body.get("age", 30))
    gender       = body.get("gender", "")
    patient_name = body.get("patientName", "")

    if not symptoms:
        return jsonify({"error": "No symptoms provided"}), 400

    # Build query document from patient symptoms
    query_text = " ".join(symptoms)

    # Transform query into the same TF-IDF space
    query_vec = vectorizer.transform([query_text])

    # Compute cosine similarity between query and all medicine documents
    similarities = cosine_similarity(query_vec, tfidf_matrix).flatten()

    # Rank medicines by similarity (descending)
    ranked_indices = np.argsort(similarities)[::-1]

    recommendations = []
    seen_base_names = set()

    for idx in ranked_indices:
        sim_score = float(similarities[idx])
        if sim_score < 0.01:
            break

        row          = med_info.iloc[idx]
        medicine     = row["medicine"]
        disease_str  = row["disease"]
        risk_str     = row["risk_factors"]

        # Deduplicate by normalised base name
        base = normalise_name(medicine)
        if base in seen_base_names:
            continue
        seen_base_names.add(base)

        safety = calculate_safety_score(risk_str, age)

        # Bonus for well-known OTC safe medicines
        if any(m in medicine.lower() for m in ["paracetamol", "acetaminophen", "loratadine"]):
            safety = min(100, safety + 10)

        recommendations.append({
            "medicine":         medicine,
            "safetyScore":      safety,
            "similarityScore":  round(sim_score, 4),
            "reason": (
                f"Matched via TF-IDF cosine similarity ({sim_score:.1%}). "
                f"Commonly indicated for: {disease_str or 'the reported symptoms'}."
            ),
            "warnings":          build_warnings(risk_str, age),
            "dosage":            get_dosage(medicine),
            "activeIngredients": [medicine],
        })

        if len(recommendations) == 5:
            break

    if not recommendations:
        recommendations = [{
            "medicine":        "No specific match found",
            "safetyScore":     0,
            "similarityScore": 0,
            "reason":          "No medicines in the dataset had sufficient similarity to the reported symptoms.",
            "warnings":        "This tool is not a substitute for professional medical advice.",
            "dosage":          "N/A",
        }]

    return jsonify({
        "recommendations": recommendations,
        "disclaimer": (
            "Recommendations generated by a TF-IDF cosine similarity model trained on a "
            "sample dataset of ~100 patient cases. This is for educational purposes only. "
            "Always consult a licensed healthcare professional before taking any medication."
        ),
        "model": {
            "name":     "TF-IDF + Cosine Similarity",
            "library":  "scikit-learn",
            "features": int(tfidf_matrix.shape[1]),
            "corpus":   int(len(med_info)),
        }
    })


# ─── Entry Point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
