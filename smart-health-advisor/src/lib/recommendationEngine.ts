/**
 * Smart Prescription AI — Recommendation Engine
 *
 * PRIMARY:  Calls the Python/Flask TF-IDF backend (localhost:5000)
 * FALLBACK: Local keyword-overlap algorithm (no backend required)
 */

export interface Recommendation {
    medicine: string;
    safetyScore: number;
    similarityScore?: number;
    reason: string;
    warnings: string;
    dosage: string;
    activeIngredients?: string[];
    diseases?: string[];
}

export interface RecommendationResult {
    recommendations: Recommendation[];
    disclaimer: string;
    source: "ml-backend" | "local-fallback";
    model?: {
        name: string;
        library: string;
        features: number;
        corpus: number;
    };
}

export interface PatientData {
    patientName: string;
    age: number;
    gender: string;
    symptoms: string[];
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://drug-prescription-model.onrender.com";

// ─── ML Backend (TF-IDF + Cosine Similarity) ─────────────────────────────────

async function fetchFromMLBackend(
    patient: PatientData
): Promise<RecommendationResult | null> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/recommend`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patient),
            signal: AbortSignal.timeout(8000), // 8s timeout
        });

        if (!response.ok) {
            console.warn("[ML Backend] HTTP error:", response.status);
            return null;
        }

        const data = await response.json();
        return { ...data, source: "ml-backend" };
    } catch (err) {
        console.warn("[ML Backend] Unavailable, using local fallback:", err);
        return null;
    }
}

// ─── Local Fallback (keyword overlap) ────────────────────────────────────────

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; }
        else { current += char; }
    }
    result.push(current.trim());
    return result;
}

interface MedicineEntry {
    name: string;
    symptoms: Set<string>;
    diseases: Set<string>;
    riskFactors: Set<string>;
    contraindications: Set<string>;
    ageRestrictions: Set<string>;
    pregnancyWarnings: Set<string>;
}

async function fetchAndParseMedications(): Promise<Map<string, MedicineEntry>> {
    const response = await fetch("/data/medication_dataset.csv");
    if (!response.ok) throw new Error("Failed to load medication dataset");
    const csvText = await response.text();
    const lines = csvText.trim().split("\n");
    const map = new Map<string, MedicineEntry>();

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 7) continue;
        const symptoms = (values[3] ?? "").split(",").map(s => s.trim()).filter(Boolean);
        const disease = values[5]?.trim() ?? "";
        const medicine = values[6]?.trim() ?? "";
        const riskRaw = values[7]?.trim() ?? "";
        if (!medicine) continue;
        let entry = map.get(medicine);
        if (!entry) {
            entry = { name: medicine, symptoms: new Set(), diseases: new Set(), riskFactors: new Set(), contraindications: new Set(), ageRestrictions: new Set(), pregnancyWarnings: new Set() };
            map.set(medicine, entry);
        }
        symptoms.forEach(s => entry!.symptoms.add(s.toLowerCase()));
        if (disease) entry.diseases.add(disease);
        if (riskRaw) {
            const rl = riskRaw.toLowerCase();
            if (rl.includes("elderly")) entry.ageRestrictions.add("Elderly patients require dose adjustment");
            if (rl.includes("pregnancy")) entry.pregnancyWarnings.add("Use with caution in pregnancy");
            if (rl.includes("allergic to") || rl.includes("avoid")) entry.contraindications.add(riskRaw);
            entry.riskFactors.add(riskRaw);
        }
    }
    return map;
}

const DOSAGE_MAP: Record<string, string> = {
    "ibuprofen": "200–400 mg every 6–8 hours with food (max 1200 mg/day OTC)",
    "paracetamol": "500–1000 mg every 4–6 hours as needed (max 4 g/day)",
    "amoxicillin": "250–500 mg three times daily for 5–7 days as prescribed",
    "amoxicillin-clavulanate": "500/125 mg three times daily for 5–7 days",
    "nitrofurantoin": "50–100 mg four times daily for 5–7 days (UTI)",
    "omeprazole": "20 mg once daily before a meal for 4–8 weeks",
    "metformin": "Start 500 mg twice daily with meals; titrate as prescribed",
    "sumatriptan": "50 mg at onset of migraine; may repeat after 2 h (max 200 mg/day)",
    "sertraline": "50 mg once daily; may be titrated to 200 mg/day",
    "lisinopril": "Start 5–10 mg once daily; adjust per blood pressure response",
    "albuterol": "1–2 puffs (100 mcg/puff) every 4–6 hours as needed",
    "salbutamol": "1–2 puffs (100 mcg/puff) every 4–6 hours as needed",
    "propranolol": "10–40 mg two to three times daily as prescribed",
    "chloramphenicol": "1–2 drops affected eye(s) every 2–6 hours for 5 days",
    "flucloxacillin": "250–500 mg four times daily as prescribed",
    "epinephrine": "0.3–0.5 mg intramuscularly in the outer thigh (emergency)",
};

function getDosage(name: string): string {
    const lower = name.toLowerCase();
    for (const [key, val] of Object.entries(DOSAGE_MAP)) {
        if (lower.includes(key)) return val;
    }
    return "Consult a healthcare provider for appropriate dosage information.";
}

function calcSafety(entry: MedicineEntry): number {
    let score = 100;
    score -= entry.riskFactors.size * 3;
    score -= entry.contraindications.size * 5;
    const rt = Array.from(entry.riskFactors).join(" ").toLowerCase();
    if (rt.includes("elderly")) score -= 5;
    if (rt.includes("pregnancy")) score -= 5;
    if (rt.includes("bleeding")) score -= 8;
    if (rt.includes("kidney") || rt.includes("renal")) score -= 7;
    if (rt.includes("liver") || rt.includes("hepatic")) score -= 7;
    if (rt.includes("anticoagulant")) score -= 6;
    if (["paracetamol", "acetaminophen", "loratadine"].some(m => entry.name.toLowerCase().includes(m))) score += 10;
    return Math.max(50, Math.min(100, score));
}

function buildWarnings(entry: MedicineEntry, age: number): string {
    const parts: string[] = [];
    if (age >= 65 && Array.from(entry.riskFactors).some(r => r.toLowerCase().includes("elderly"))) parts.push("Dose reduction may be needed for elderly patients.");
    if (entry.contraindications.size > 0) parts.push(Array.from(entry.contraindications).join("; "));
    if (entry.pregnancyWarnings.size > 0) parts.push(Array.from(entry.pregnancyWarnings).join("; "));
    return parts.length > 0 ? parts.join(" ") : "No major warnings identified for typical adults.";
}

async function localFallback(patient: PatientData): Promise<RecommendationResult> {
    const map = await fetchAndParseMedications();
    const patientLower = patient.symptoms.map(s => s.toLowerCase());

    const scored = Array.from(map.values())
        .map(entry => {
            let matches = 0;
            for (const ps of patientLower) {
                for (const ms of entry.symptoms) {
                    if (ms.includes(ps) || ps.includes(ms)) { matches++; break; }
                }
            }
            return { entry, matches, safety: calcSafety(entry) };
        })
        .filter(x => x.matches > 0)
        .sort((a, b) => b.matches !== a.matches ? b.matches - a.matches : b.safety - a.safety);

    const seen = new Set<string>();
    const top = scored.filter(({ entry }) => {
        const key = entry.name.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();
        if (seen.has(key)) return false;
        seen.add(key); return true;
    }).slice(0, 5);

    if (top.length === 0) {
        return {
            recommendations: [{ medicine: "No specific match found", safetyScore: 0, reason: "No medicines matched the entered symptoms.", warnings: "Please consult a healthcare professional.", dosage: "N/A" }],
            disclaimer: "No recommendations could be generated. Always consult a licensed healthcare professional.",
            source: "local-fallback",
        };
    }

    return {
        recommendations: top.map(({ entry, safety, matches }) => ({
            medicine: entry.name,
            safetyScore: safety,
            reason: `Matched ${matches} symptom(s). Commonly used for: ${Array.from(entry.diseases).slice(0, 2).join(", ")}.`,
            warnings: buildWarnings(entry, patient.age),
            dosage: getDosage(entry.name),
            activeIngredients: [entry.name],
        })),
        disclaimer: "Recommendations generated by local keyword-matching (ML backend offline). Always consult a licensed healthcare professional before taking any medication.",
        source: "local-fallback",
    };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkBackendHealth(): Promise<boolean> {
    try {
        const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    } catch {
        return false;
    }
}

export async function getRecommendations(patient: PatientData): Promise<RecommendationResult> {
    // Try ML backend first
    const mlResult = await fetchFromMLBackend(patient);
    if (mlResult) return mlResult;

    // Fall back to local algorithm
    return localFallback(patient);
}
