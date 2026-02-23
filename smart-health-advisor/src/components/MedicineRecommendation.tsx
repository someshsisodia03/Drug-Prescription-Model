import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Pill } from "lucide-react";

interface Recommendation {
  medicine: string;
  safetyScore: number;
  similarityScore?: number;
  reason: string;
  warnings: string;
  dosage: string;
  activeIngredients?: string[];
}

interface MedicineRecommendationProps {
  recommendations: Recommendation[];
  disclaimer: string;
}

export const MedicineRecommendation = ({
  recommendations,
  disclaimer
}: MedicineRecommendationProps) => {
  const getSafetyColor = (score: number) => {
    if (score >= 80) return "success";
    if (score >= 60) return "warning";
    return "destructive";
  };

  const getSafetyText = (score: number) => {
    if (score >= 80) return "Highly Safe";
    if (score >= 60) return "Moderately Safe";
    return "Use with Caution";
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          AI-Recommended Medicines
        </h2>
        <p className="text-muted-foreground">
          Based on symptom analysis and safety profiles
        </p>
      </div>

      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <Card key={index} className="p-6 shadow-card hover:shadow-elevated transition-shadow">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-1">
                    <Pill className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-foreground">
                      {rec.medicine}
                    </h3>
                    {rec.activeIngredients && rec.activeIngredients.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {rec.activeIngredients.join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Safety Score + Similarity Badge */}
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant={getSafetyColor(rec.safetyScore) as any}
                    className="text-sm font-semibold px-3 py-1"
                  >
                    {rec.safetyScore}/100
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {getSafetyText(rec.safetyScore)}
                  </span>
                  {rec.similarityScore !== undefined && rec.similarityScore > 0 && (
                    <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {(rec.similarityScore * 100).toFixed(1)}% match
                    </span>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-foreground">Why This Medicine?</p>
                    <p className="text-sm text-muted-foreground">{rec.reason}</p>
                  </div>
                </div>
              </div>

              {/* Dosage */}
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="font-semibold text-sm text-foreground mb-1">Recommended Dosage</p>
                <p className="text-sm text-foreground">{rec.dosage}</p>
              </div>

              {/* Warnings */}
              {rec.warnings && rec.warnings.toLowerCase() !== 'none' && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-foreground">Important Warnings</p>
                      <p className="text-sm text-muted-foreground">{rec.warnings}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Disclaimer */}
      <Card className="p-4 bg-muted border-border">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm text-foreground mb-1">Medical Disclaimer</p>
            <p className="text-sm text-muted-foreground">{disclaimer}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};