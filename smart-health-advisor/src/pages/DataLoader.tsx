import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Database, CheckCircle2, AlertCircle, Pill } from "lucide-react";
import { Link } from "react-router-dom";

interface MedicineSummary {
  name: string;
  symptoms: string[];
  diseases: string[];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const DataLoader = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [medicines, setMedicines] = useState<MedicineSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCSV = async () => {
      try {
        const response = await fetch("/data/medication_dataset.csv");
        if (!response.ok) throw new Error("Could not load medication dataset CSV");
        const csvText = await response.text();

        const lines = csvText.trim().split("\n");
        const medicationMap = new Map<string, MedicineSummary>();

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length < 7) continue;

          const symptomsRaw = values[3] ?? "";
          const disease = values[5]?.trim() ?? "";
          const medicine = values[6]?.trim() ?? "";
          if (!medicine) continue;

          const symptoms = symptomsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

          if (!medicationMap.has(medicine)) {
            medicationMap.set(medicine, { name: medicine, symptoms: [], diseases: [] });
          }
          const entry = medicationMap.get(medicine)!;
          symptoms.forEach((s) => {
            if (!entry.symptoms.includes(s)) entry.symptoms.push(s);
          });
          if (disease && !entry.diseases.includes(disease)) {
            entry.diseases.push(disease);
          }
        }

        setMedicines(Array.from(medicationMap.values()));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    loadCSV();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Database className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Dataset Info</h1>
                <p className="text-sm text-muted-foreground">Local Medication Dataset</p>
              </div>
            </div>
            <Link to="/">
              <Button variant="outline">Back to App</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="space-y-6">
          {/* Status Card */}
          <Card className="p-6 shadow-card">
            {isLoading && (
              <p className="text-muted-foreground text-center py-4">Loading dataset…</p>
            )}

            {error && (
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-destructive mt-1" />
                <div>
                  <p className="font-bold text-foreground">Error loading dataset</p>
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            )}

            {!isLoading && !error && (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500 mt-1" />
                <div className="flex-1">
                  <p className="font-bold text-foreground text-lg mb-1">
                    Dataset loaded successfully
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    The app uses a local CSV dataset bundled with the project — no cloud
                    deployment or API key required.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{medicines.length}</p>
                      <p className="text-sm text-muted-foreground">Unique Medicines</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-primary">
                        {[...new Set(medicines.flatMap((m) => m.diseases))].length}
                      </p>
                      <p className="text-sm text-muted-foreground">Conditions Covered</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Medicine list */}
          {!isLoading && !error && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-foreground">Medicines in Dataset</h2>
              {medicines.map((med) => (
                <Card key={med.name} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <Pill className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{med.name}</p>
                      {med.diseases.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {med.diseases.join(" · ")}
                        </p>
                      )}
                      {med.symptoms.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {med.symptoms.map((s) => (
                            <span
                              key={s}
                              className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Info card */}
          <Card className="p-4 bg-muted">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-foreground mb-1">How It Works</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Recommendations are generated locally — no internet needed</li>
                  <li>• The CSV file lives in <code>public/data/medication_dataset.csv</code></li>
                  <li>• Symptom matching uses keyword overlap scoring</li>
                  <li>• Safety scores are calculated from risk factors in the dataset</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default DataLoader;