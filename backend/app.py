"""
Smart Prescription AI — Python Backend
TF-IDF + Cosine Similarity recommendation engine (scikit-learn)
+ Iterative Conversational Refinement (/api/chat)

Run:  python app.py
API:  http://localhost:5000
"""

import os
import re
import numpy as np
import pandas as pd
from difflib import get_close_matches
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

print("Loading medication dataset ...")
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

# ─── Extract Known Symptoms & Per-Medicine Symptom Sets ──────────────────────

known_symptoms = set()
med_raw_symptoms = {}

for medicine_name in med_info["medicine"]:
    rows = df[df["Medicine"] == medicine_name]
    all_syms = set()
    for _, row in rows.iterrows():
        parts = str(row.get("Symptoms", "")).split(",")
        for p in parts:
            p = p.strip()
            if p:
                all_syms.add(p)
                known_symptoms.add(p.lower())
    med_raw_symptoms[medicine_name] = all_syms

known_symptoms_list = sorted(known_symptoms)
print(f"Extracted {len(known_symptoms)} unique symptoms from dataset")

# ─── Build TF-IDF Matrix ─────────────────────────────────────────────────────

print(f"Building TF-IDF matrix for {len(med_info)} unique medicines ...")

vectorizer = TfidfVectorizer(
    ngram_range=(1, 2),       # unigrams + bigrams capture "sore throat" etc.
    stop_words="english",
    min_df=1,
    sublinear_tf=True,        # log-scaled TF to dampen very frequent terms
)

tfidf_matrix = vectorizer.fit_transform(med_info["symptom_doc"])
print("TF-IDF matrix shape:", tfidf_matrix.shape)
print("Backend ready [OK]\n")

# ─── Helpers ─────────────────────────────────────────────────────────────────

DOSAGE_MAP = {
    "ibuprofen":                        "200-400 mg every 6-8 hours with food (max 1200 mg/day OTC)",
    "paracetamol":                      "500-1000 mg every 4-6 hours as needed (max 4 g/day)",
    "amoxicillin":                      "250-500 mg three times daily for 5-7 days as prescribed",
    "amoxicillin-clavulanate":          "500/125 mg three times daily for 5-7 days as prescribed",
    "nitrofurantoin":                   "50-100 mg four times daily for 5-7 days (UTI)",
    "omeprazole":                       "20 mg once daily before a meal for 4-8 weeks",
    "metformin":                        "Start 500 mg twice daily with meals; titrate as prescribed",
    "sumatriptan":                      "50 mg at onset of migraine; may repeat after 2 h (max 200 mg/day)",
    "sertraline":                       "50 mg once daily; may be titrated to 200 mg/day",
    "lisinopril":                       "Start 5-10 mg once daily; adjust per blood pressure response",
    "albuterol":                        "1-2 puffs (100 mcg/puff) every 4-6 hours as needed",
    "salbutamol":                       "1-2 puffs (100 mcg/puff) every 4-6 hours as needed",
    "propranolol":                      "10-40 mg two to three times daily as prescribed",
    "chloramphenicol":                  "1-2 drops affected eye(s) every 2-6 hours for 5 days",
    "flucloxacillin":                   "250-500 mg four times daily as prescribed",
    "epinephrine":                      "0.3-0.5 mg intramuscularly in outer thigh (emergency use only)",
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
        parts.append("May interact with anticoagulant therapy - monitor closely.")
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


# ─── Synonym Map ─────────────────────────────────────────────────────────────
# ONLY for truly different vocabulary (where the WORDS are completely different).
# If the user's words partially overlap with dataset words (like "chest pain"
# vs "chest pain on exertion"), TF-IDF handles it automatically via shared tokens.
# We only need this map when the user uses DIFFERENT words for the same thing.

SYNONYM_MAP = {
    # User says X, but dataset uses completely different word Y
    "tummy ache":           "stomach pain",
    "stomach ache":         "stomach pain",
    "acidity":              "acid reflux",
    "gas":                  "dyspepsia",
    "indigestion":          "dyspepsia",
    "throwing up":          "vomiting",
    "puking":               "vomiting",
    "loose motion":         "diarrhea",
    "loose stool":          "diarrhea",
    "migraine":             "frequent headaches",
    "cephalalgia":          "headache",
    "breathlessness":       "shortness of breath",
    "cant breathe":         "difficulty breathing",
    "hard to breathe":      "difficulty breathing",
    "wheezing":             "wheeze",
    "hay fever":            "sneezing",
    "high temperature":     "fever",
    "temperature":          "fever",
    "tired":                "fatigue",
    "tiredness":            "fatigue",
    "exhaustion":           "fatigue",
    "sugar problem":        "high glucose",
    "peeing a lot":         "frequent urination",
    "feeling low":          "depressed mood",
    "sadness":              "depressed mood",
    "cant sleep":           "sleep disturbance",
    "insomnia":             "sleep disturbance",
    "giddiness":            "dizziness",
    "light headed":         "dizziness",
    "vertigo":              "dizziness",
    "heart racing":         "palpitations",
    "rapid heartbeat":      "palpitations",
    "anaphylaxis":          "severe allergic swelling",
    "excess thirst":        "polydipsia",
    "excessive thirst":     "polydipsia",
}


def expand_symptom(symptom: str) -> list:
    """
    Minimal expansion — only translate truly different vocabulary.
    For everything else, pass raw input to TF-IDF (it handles partial matches).
    """
    lower = symptom.lower().strip()

    # 1. Synonym map — only fires when words are completely different
    if lower in SYNONYM_MAP:
        return [SYNONYM_MAP[lower]]

    # 2. Typo correction — only very close matches (0.85 cutoff = must be almost identical)
    if lower not in known_symptoms:
        matches = get_close_matches(lower, known_symptoms_list, n=1, cutoff=0.85)
        if matches:
            return matches

    # 3. Pass as-is to TF-IDF — it handles partial matching via shared tokens
    #    e.g. "chest pain" shares tokens with "chest pain on exertion"
    return [lower]


def expand_symptoms(symptoms: list) -> tuple:
    """Expand all symptoms. Returns (expanded_list, mapping_dict)."""
    expanded = []
    mapping = {}
    for s in symptoms:
        exps = expand_symptom(s)
        expanded.extend(exps)
        if exps != [s.lower().strip()]:
            mapping[s] = [e.title() for e in exps]
    return expanded, mapping


# ─── Differentiating Symptoms Algorithm ──────────────────────────────────────

def find_differentiating_symptoms(candidate_list, confirmed, denied):
    """
    Given candidate medicines and already-known symptoms, find symptoms
    that best SPLIT the candidate set — i.e., appear in some candidates
    but not all. These become follow-up questions.
    """
    confirmed_lower = {s.lower() for s in confirmed}
    denied_lower = {s.lower() for s in denied}

    # Build per-candidate symptom sets
    cand_syms = {}
    for c in candidate_list[:6]:
        med = c["medicine"]
        if med in med_raw_symptoms:
            cand_syms[med] = {s.lower() for s in med_raw_symptoms[med]}

    if len(cand_syms) < 2:
        return []

    # Collect all symptoms across candidates
    all_syms = set()
    for syms in cand_syms.values():
        all_syms.update(syms)

    # Remove already confirmed and denied
    remaining = all_syms - confirmed_lower - denied_lower

    # Score each symptom by discriminative power
    # Best discriminator: appears in ~half of candidates (splits them evenly)
    n = len(cand_syms)
    scored = []
    for sym in remaining:
        count = sum(1 for syms in cand_syms.values() if sym in syms)
        # Skip if present in all or none (doesn't help differentiate)
        if count == 0 or count == n:
            continue
        # Discrimination score: 1.0 when in exactly half, lower otherwise
        disc = 1.0 - abs(count / n - 0.5) * 2
        scored.append((sym, disc, count))

    # Sort by discrimination score (best splitters first)
    scored.sort(key=lambda x: (-x[1], -x[2]))

    return [s[0].title() for s in scored[:4]]


# ─── Build Recommendation Response Helper ────────────────────────────────────

def build_recommendations(candidate_list, age, max_results=5):
    """Build recommendation dicts from a list of candidates."""
    recs = []
    top_score = candidate_list[0]["score"] if candidate_list else 0
    for c in candidate_list[:max_results]:
        # Skip medicines with score < 50% of the top medicine (not relevant enough)
        if top_score > 0 and c["score"] < top_score * 0.50:
            continue
        idx = c["idx"]
        row = med_info.iloc[idx]
        risk_str = row["risk_factors"]
        safety = calculate_safety_score(risk_str, age)

        # OTC safety bonus
        if any(m in row["medicine"].lower() for m in ["paracetamol", "acetaminophen", "loratadine"]):
            safety = min(100, safety + 10)

        recs.append({
            "medicine":         row["medicine"],
            "safetyScore":      safety,
            "similarityScore":  c["score"],
            "reason": (
                f"Matched via TF-IDF cosine similarity ({c['score']:.1%}). "
                f"Commonly indicated for: {row['disease'] or 'the reported symptoms'}."
            ),
            "warnings":          build_warnings(risk_str, age),
            "dosage":            get_dosage(row["medicine"]),
            "activeIngredients": [row["medicine"]],
        })

    return recs


def get_candidates(query_symptoms, denied_symptoms=None):
    """Run TF-IDF and return ranked, deduplicated candidates."""
    query_text = " ".join(query_symptoms)
    query_vec = vectorizer.transform([query_text])
    similarities = cosine_similarity(query_vec, tfidf_matrix).flatten()

    # If denied symptoms are provided, penalise medicines whose
    # primary symptoms overlap with denied ones
    if denied_symptoms:
        denied_lower = {s.lower() for s in denied_symptoms}
        for idx in range(len(similarities)):
            med = med_info.iloc[idx]["medicine"]
            if med in med_raw_symptoms:
                med_syms = {s.lower() for s in med_raw_symptoms[med]}
                # How many of this medicine's symptoms were denied?
                denied_overlap = len(med_syms & denied_lower)
                if denied_overlap > 0 and len(med_syms) > 0:
                    penalty = 0.15 * (denied_overlap / len(med_syms))
                    similarities[idx] = max(0, similarities[idx] - penalty)

    ranked = np.argsort(similarities)[::-1]
    candidates = []
    seen = set()

    for idx in ranked:
        score = float(similarities[idx])
        if score < 0.01:
            break
        medicine = med_info.iloc[idx]["medicine"]
        base = normalise_name(medicine)
        if base in seen:
            continue
        seen.add(base)
        candidates.append({
            "idx":      int(idx),
            "medicine": medicine,
            "score":    round(score, 4),
            "diseases": med_info.iloc[idx]["disease"],
        })

    return candidates


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "medicines": int(len(med_info)),
        "tfidf_features": int(tfidf_matrix.shape[1]),
        "known_symptoms": len(known_symptoms),
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


# ─── Conversational Refinement Endpoint ──────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Multi-turn conversational endpoint.
    Accepts confirmed + denied symptoms, returns either:
      - "needs_more_info"  with follow-up questions
      - "resolved"         with final recommendations
      - "no_match"         when symptoms are unknown to the dataset
    """
    body      = request.get_json(force=True)
    confirmed = body.get("confirmed", [])     # symptoms the user confirmed
    denied    = body.get("denied", [])         # symptoms the user said "No" to
    age       = int(body.get("age", 30))
    gender    = body.get("gender", "")
    round_num = int(body.get("round", 1))

    if not confirmed:
        return jsonify({"error": "No symptoms provided"}), 400

    # ── Step 1: Expand symptoms (synonym + fuzzy matching) ───────────────
    expanded, sym_mapping = expand_symptoms(confirmed)

    # ── Step 2: Run TF-IDF with expanded symptoms ────────────────────────
    candidates = get_candidates(expanded, denied)

    # ── Step 3: Handle no matches (unknown symptoms) ─────────────────────
    if not candidates:
        return jsonify({
            "status":  "no_match",
            "message": (
                "The symptoms you described don't closely match any medicines "
                "in our dataset. This could mean the condition requires "
                "specialist consultation. Please visit a healthcare professional."
            ),
            "symptomMapping": sym_mapping,
            "confirmedSymptoms": confirmed,
        })

    # ── Step 4: Decide if resolved or need more info ─────────────────────
    #    Round 1: ALWAYS ask follow-ups if there are multiple candidates
    #    Round 2+: resolve if dominant candidate or <=1 candidate
    #    Round 3: always resolve (max rounds)
    if round_num == 1:
        is_resolved = len(candidates) <= 1
    else:
        is_resolved = (
            len(candidates) <= 1
            or round_num >= 3
            or (len(candidates) >= 2 and candidates[0]["score"] > 2 * candidates[1]["score"])
        )

    if not is_resolved:
        # Find differentiating follow-up questions
        follow_ups = find_differentiating_symptoms(candidates, confirmed, denied)
        if not follow_ups:
            is_resolved = True  # No more questions to ask

    if is_resolved:
        # ── Resolved: return final recommendations ───────────────────
        # After chat refinement, show only top 2 narrowed-down results
        recs = build_recommendations(candidates, age, max_results=2)

        if not recs:
            recs = [{
                "medicine":        "No specific match found",
                "safetyScore":     0,
                "similarityScore": 0,
                "reason":          "No medicines matched after refinement.",
                "warnings":        "Please consult a healthcare professional.",
                "dosage":          "N/A",
            }]

        return jsonify({
            "status": "resolved",
            "recommendations": recs,
            "disclaimer": (
                "Recommendations generated by iterative TF-IDF cosine similarity "
                "refinement. This is for educational purposes only. "
                "Always consult a licensed healthcare professional."
            ),
            "model": {
                "name":     "TF-IDF + Cosine Similarity (Iterative Refinement)",
                "library":  "scikit-learn",
                "features": int(tfidf_matrix.shape[1]),
                "corpus":   int(len(med_info)),
            },
            "symptomMapping": sym_mapping,
            "round": round_num,
        })

    # ── Not resolved: ask follow-up questions ────────────────────────
    return jsonify({
        "status": "needs_more_info",
        "candidates": [
            {"medicine": c["medicine"], "score": c["score"], "diseases": c["diseases"]}
            for c in candidates[:5]
        ],
        "followUpQuestions": follow_ups,
        "message": (
            "I found multiple matching medicines. "
            "To narrow it down, do you also experience any of these symptoms?"
        ),
        "symptomMapping": sym_mapping,
        "round": round_num,
    })


# ─── Medicine Info Lookup ────────────────────────────────────────────────────

@app.route("/api/medicine-info", methods=["POST"])
def medicine_info():
    """Look up detailed information for a given medicine name."""
    data = request.get_json(force=True)
    query = (data.get("medicine") or "").strip()

    if not query:
        return jsonify({"status": "error", "message": "Please provide a medicine name."}), 400

    query_lower = query.lower()

    # 1. Try exact match (case-insensitive)
    match = None
    for idx, row in med_info.iterrows():
        if row["medicine"].lower() == query_lower or normalise_name(row["medicine"]) == normalise_name(query):
            match = (idx, row)
            break

    # 2. Try substring match (user typed partial name)
    if not match:
        for idx, row in med_info.iterrows():
            if query_lower in row["medicine"].lower() or row["medicine"].lower() in query_lower:
                match = (idx, row)
                break

    # 3. Try fuzzy match
    if not match:
        all_names = list(med_info["medicine"])
        all_lower = [n.lower() for n in all_names]
        fuzzy = get_close_matches(query_lower, all_lower, n=1, cutoff=0.5)
        if fuzzy:
            fuzzy_idx = all_lower.index(fuzzy[0])
            match = (fuzzy_idx, med_info.iloc[fuzzy_idx])

    if not match:
        # Return list of available medicines as suggestions
        available = sorted(med_info["medicine"].tolist())
        return jsonify({
            "status": "not_found",
            "message": f"Medicine '{query}' not found in our database.",
            "suggestions": available,
        })

    idx, row = match
    medicine_name = row["medicine"]

    # Gather all raw data from the original CSV for this medicine
    raw_rows = df[df["Medicine"] == medicine_name]

    # Unique symptoms
    symptoms = sorted(med_raw_symptoms.get(medicine_name, set()))

    # Unique diseases
    diseases = sorted(raw_rows["Disease"].dropna().unique().tolist())

    # Unique causes
    causes = sorted(raw_rows["Causes"].dropna().unique().tolist())

    # Unique risk factors
    risk_factors = sorted(raw_rows["RiskFactors"].dropna().unique().tolist())

    # Unique source references
    sources = sorted(raw_rows["SourceReference"].dropna().unique().tolist())

    # Safety score (for age 30 as default)
    age = data.get("age", 30)
    risk_str = row.get("risk_factors", "")
    safety = calculate_safety_score(risk_str, age)
    warnings = build_warnings(risk_str, age)
    dosage = get_dosage(medicine_name)

    return jsonify({
        "status": "found",
        "medicine": medicine_name,
        "diseases": diseases,
        "symptoms": symptoms,
        "causes": causes,
        "riskFactors": risk_factors,
        "sources": sources,
        "safetyScore": safety,
        "warnings": warnings,
        "dosage": dosage,
        "totalRecords": len(raw_rows),
    })


@app.route("/api/medicine-list", methods=["GET"])
def medicine_list():
    """Return all available medicine names for autocomplete."""
    names = sorted(med_info["medicine"].tolist())
    return jsonify({"medicines": names})


# ─── Entry Point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
