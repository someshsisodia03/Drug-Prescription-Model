import { useState, useEffect } from "react";
import { Activity, Cpu, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PatientIntakeForm, PatientData } from "@/components/PatientIntakeForm";
import { MedicineRecommendation } from "@/components/MedicineRecommendation";
import { useToast } from "@/hooks/use-toast";
import {
  getRecommendations,
  checkBackendHealth,
  RecommendationResult,
} from "@/lib/recommendationEngine";

const Index = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<RecommendationResult | null>(null);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const { toast } = useToast();

  // Probe backend health on mount
  useEffect(() => {
    checkBackendHealth().then(setBackendUp);
  }, []);

  const handleSubmit = async (data: PatientData) => {
    setIsLoading(true);
    setResults(null);

    try {
      const result = await getRecommendations(data);
      setResults(result);

      const isML = result.source === "ml-backend";
      toast({
        title: "Analysis Complete",
        description: `Found ${result.recommendations.length} recommendation(s) via ${isML ? "TF-IDF ML model" : "local keyword engine"
          }.`,
      });
    } catch (error) {
      console.error("Error getting recommendations:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to get recommendations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSearch = () => setResults(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Activity className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Smart Prescription AI</h1>
                <p className="text-sm text-muted-foreground">TF-IDF + Cosine Similarity Recommendations</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Backend status badge */}
              {backendUp !== null && (
                <span
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${backendUp
                      ? "bg-green-500/10 text-green-600 border-green-500/30"
                      : "bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
                    }`}
                >
                  <Cpu className="h-3.5 w-3.5" />
                  {backendUp ? "ML Backend Online" : "Local Fallback"}
                </span>
              )}
              <Link to="/load-data">
                <Button variant="outline">Dataset Info</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Offline warning banner */}
      {backendUp === false && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
          <p className="container mx-auto text-xs text-yellow-700 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            ML backend is not running — using local keyword-matching.
            Start it with: <code className="font-mono bg-yellow-500/10 px-1 rounded">python backend/app.py</code>
          </p>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {!results ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-foreground">Patient Information</h2>
              <p className="text-muted-foreground">
                Enter patient details to receive medicine recommendations
              </p>
            </div>
            <PatientIntakeForm onSubmit={handleSubmit} isLoading={isLoading} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Model metadata card */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${results.source === "ml-backend"
                ? "bg-green-500/10 border-green-500/20 text-green-700"
                : "bg-yellow-500/10 border-yellow-500/20 text-yellow-700"
              }`}>
              <Cpu className="h-4 w-4 flex-shrink-0" />
              {results.source === "ml-backend" && results.model ? (
                <span>
                  Powered by <strong>{results.model.name}</strong> ({results.model.library}) ·{" "}
                  {results.model.features.toLocaleString()} TF-IDF features ·{" "}
                  {results.model.corpus} medicines in corpus
                </span>
              ) : (
                <span>
                  ML backend offline — results from <strong>local keyword-matching engine</strong>
                </span>
              )}
            </div>

            <MedicineRecommendation
              recommendations={results.recommendations}
              disclaimer={results.disclaimer}
            />
            <div className="flex justify-center">
              <button
                onClick={handleNewSearch}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
              >
                New Patient Analysis
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6 bg-card/30">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Smart Prescription AI · TF-IDF + Cosine Similarity (scikit-learn)</p>
          <p className="mt-1">Always consult healthcare professionals for medical decisions</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;