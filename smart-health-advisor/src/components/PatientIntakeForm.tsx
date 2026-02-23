import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface PatientIntakeFormProps {
  onSubmit: (data: PatientData) => void;
  isLoading: boolean;
}

export interface PatientData {
  patientName: string;
  age: number;
  gender: string;
  symptoms: string[];
}

const commonSymptoms = [
  "Fever",
  "Headache",
  "Cough",
  "Fatigue",
  "Nausea",
  "Body Ache",
  "Sore Throat",
  "Runny Nose",
  "Dizziness",
  "Stomach Pain",
  "Chest Pain",
  "Shortness of Breath"
];

export const PatientIntakeForm = ({ onSubmit, isLoading }: PatientIntakeFormProps) => {
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");

  const handleSymptomToggle = (symptom: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleAddCustomSymptom = () => {
    if (customSymptom.trim() && !selectedSymptoms.includes(customSymptom.trim())) {
      setSelectedSymptoms(prev => [...prev, customSymptom.trim()]);
      setCustomSymptom("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (patientName && age && gender && selectedSymptoms.length > 0) {
      onSubmit({
        patientName,
        age: parseInt(age),
        gender,
        symptoms: selectedSymptoms
      });
    }
  };

  return (
    <Card className="p-8 shadow-card">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="patientName" className="text-base font-semibold">
            Patient Name
          </Label>
          <Input
            id="patientName"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Enter full name"
            required
            disabled={isLoading}
            className="h-12"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="age" className="text-base font-semibold">
              Age
            </Label>
            <Input
              id="age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Enter age"
              required
              min="1"
              max="120"
              disabled={isLoading}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender" className="text-base font-semibold">
              Gender
            </Label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required
              disabled={isLoading}
              className="h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-base font-semibold">Symptoms</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {commonSymptoms.map((symptom) => (
              <div key={symptom} className="flex items-center space-x-2">
                <Checkbox
                  id={symptom}
                  checked={selectedSymptoms.includes(symptom)}
                  onCheckedChange={() => handleSymptomToggle(symptom)}
                  disabled={isLoading}
                />
                <Label
                  htmlFor={symptom}
                  className="text-sm font-normal cursor-pointer"
                >
                  {symptom}
                </Label>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Input
              value={customSymptom}
              onChange={(e) => setCustomSymptom(e.target.value)}
              placeholder="Add custom symptom"
              disabled={isLoading}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomSymptom())}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddCustomSymptom}
              disabled={isLoading || !customSymptom.trim()}
            >
              Add
            </Button>
          </div>

          {selectedSymptoms.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {selectedSymptoms.map((symptom) => (
                <span
                  key={symptom}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm"
                >
                  {symptom}
                  <button
                    type="button"
                    onClick={() => handleSymptomToggle(symptom)}
                    disabled={isLoading}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isLoading || !patientName || !age || !gender || selectedSymptoms.length === 0}
          className="w-full h-12 text-base font-semibold"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Analyzing Symptoms...
            </>
          ) : (
            "Get AI Recommendations"
          )}
        </Button>
      </form>
    </Card>
  );
};