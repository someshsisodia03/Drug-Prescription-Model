import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Pill,
  Shield,
  AlertTriangle,
  Activity,
  BookOpen,
  ChevronRight,
  Loader2,
  XCircle,
  Stethoscope,
  Beaker,
  Heart,
} from "lucide-react";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

interface MedicineInfo {
  medicine: string;
  diseases: string[];
  symptoms: string[];
  causes: string[];
  riskFactors: string[];
  sources: string[];
  safetyScore: number;
  warnings: string;
  dosage: string;
  totalRecords: number;
}

export const MedicineLookup = () => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allMedicines, setAllMedicines] = useState<string[]>([]);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MedicineInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${BACKEND}/api/medicine-list`)
      .then((r) => r.json())
      .then((data) => setAllMedicines(data.medicines || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) { setFiltered([]); return; }
    const q = query.toLowerCase();
    setFiltered(allMedicines.filter((m) => m.toLowerCase().includes(q)).slice(0, 8));
  }, [query, allMedicines]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const lookupMedicine = async (name?: string) => {
    const searchName = name || query;
    if (!searchName.trim()) return;
    setIsLoading(true); setError(null); setResult(null); setSuggestions([]); setShowDropdown(false);
    try {
      const res = await fetch(`${BACKEND}/api/medicine-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicine: searchName }),
      });
      const data = await res.json();
      if (data.status === "found") setResult(data);
      else if (data.status === "not_found") { setError(data.message); setSuggestions(data.suggestions || []); }
      else setError(data.message || "Something went wrong.");
    } catch { setError("Could not connect to the backend."); }
    finally { setIsLoading(false); }
  };

  const safetyColor = (score: number) => {
    if (score >= 85) return { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", ring: "ring-emerald-500/20" };
    if (score >= 70) return { text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", ring: "ring-amber-500/20" };
    return { text: "text-red-600", bg: "bg-red-50", border: "border-red-200", ring: "ring-red-500/20" };
  };

  const safetyLabel = (score: number) => {
    if (score >= 85) return "Highly Safe";
    if (score >= 70) return "Moderately Safe";
    return "Use with Caution";
  };

  const sc = result ? safetyColor(result.safetyScore) : null;

  return (
    <div className="space-y-5 pt-2">
      {/* Search */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
              <Pill className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Medicine Lookup</h2>
              <p className="text-xs text-gray-500">Search any medicine for detailed info</p>
            </div>
          </div>

          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => query.trim() && setShowDropdown(true)}
                  onKeyDown={(e) => { if (e.key === "Enter") lookupMedicine(); }}
                  placeholder="e.g. Paracetamol, Amoxicillin..."
                  className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all"
                />
              </div>
              <Button
                onClick={() => lookupMedicine()}
                disabled={isLoading || !query.trim()}
                className="h-12 px-5 font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            {showDropdown && filtered.length > 0 && (
              <div ref={dropdownRef} className="absolute z-50 w-full mt-1.5 bg-white rounded-xl border border-gray-100 shadow-2xl max-h-60 overflow-y-auto">
                {filtered.map((med) => (
                  <button key={med}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 flex items-center gap-2 transition-colors border-b border-gray-50 last:border-0"
                    onClick={() => { setQuery(med); setShowDropdown(false); lookupMedicine(med); }}>
                    <Pill className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                    <span className="font-medium text-gray-700">{med}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-300 ml-auto" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="flex items-center justify-center gap-3 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Looking up medicine...</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-3">
              <p className="text-sm text-red-700 font-semibold">{error}</p>
              {suggestions.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Try one of these:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.slice(0, 10).map((s) => (
                      <button key={s}
                        className="text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors font-medium"
                        onClick={() => { setQuery(s); lookupMedicine(s); }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && sc && (
        <div className="space-y-3">
          {/* Header Card */}
          <div className="bg-white rounded-2xl p-5 shadow-xl border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-200/40">
                <Pill className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-extrabold text-gray-900 leading-tight">{result.medicine}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {result.totalRecords} clinical record{result.totalRecords > 1 ? "s" : ""} in database
                </p>
              </div>
              <div className={`text-center px-4 py-2 rounded-2xl ${sc.bg} border ${sc.border} ring-4 ${sc.ring}`}>
                <div className={`text-2xl font-black ${sc.text}`}>{result.safetyScore}</div>
                <div className={`text-[10px] font-bold ${sc.text} uppercase tracking-wide`}>{safetyLabel(result.safetyScore)}</div>
              </div>
            </div>
          </div>

          {/* Diseases */}
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-blue-50 rounded-lg">
                <Stethoscope className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">Treats</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.diseases.map((d) => (
                <span key={d} className="text-xs py-1.5 px-3 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-100">{d}</span>
              ))}
            </div>
          </div>

          {/* Symptoms */}
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-purple-50 rounded-lg">
                <Activity className="h-3.5 w-3.5 text-purple-600" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">Related Symptoms</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.symptoms.map((s) => (
                <span key={s} className="text-xs py-1.5 px-3 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-100">{s}</span>
              ))}
            </div>
          </div>

          {/* Dosage */}
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-emerald-50 rounded-lg">
                <Beaker className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">Dosage</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed bg-emerald-50/50 rounded-xl px-4 py-3 border border-emerald-100 font-medium">
              {result.dosage}
            </p>
          </div>

          {/* Warnings */}
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-amber-50 rounded-lg">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">Warnings</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed bg-amber-50/50 rounded-xl px-4 py-3 border border-amber-100 font-medium">
              {result.warnings}
            </p>
          </div>

          {/* Risk Factors */}
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-red-50 rounded-lg">
                <Shield className="h-3.5 w-3.5 text-red-500" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">Risk Factors</h3>
            </div>
            <ul className="space-y-1.5">
              {result.riskFactors.map((r) => (
                <li key={r} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-red-300 mt-1 text-xs">●</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sources */}
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-teal-50 rounded-lg">
                <BookOpen className="h-3.5 w-3.5 text-teal-600" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">Sources</h3>
            </div>
            <ul className="space-y-1.5">
              {result.sources.map((s) => (
                <li key={s} className="text-sm text-gray-500 flex items-start gap-2">
                  <span className="text-teal-300 mt-1 text-xs">●</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
