import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, X, User, Calendar, Users, Thermometer, Sparkles } from "lucide-react";

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
  "Fever", "Headache", "Cough", "Fatigue",
  "Nausea", "Body Ache", "Sore Throat", "Runny Nose",
  "Dizziness", "Stomach Pain", "Chest Pain", "Shortness of Breath"
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
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <form onSubmit={handleSubmit}>
        {/* Patient Details Section */}
        <div className="p-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="patientName" className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Patient Name
            </Label>
            <Input
              id="patientName"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Enter full name"
              required
              disabled={isLoading}
              className="h-12 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-blue-400 text-base transition-colors"
            />
          </div>

          {/* Age & Gender Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="age" className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Age
              </Label>
              <Input
                id="age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Age"
                required
                min="1"
                max="120"
                disabled={isLoading}
                className="h-12 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-blue-400 text-base transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gender" className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Gender
              </Label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-colors appearance-none"
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Symptoms Section */}
        <div className="border-t border-gray-100 bg-gray-50/30 p-5 space-y-3">
          <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Thermometer className="h-3.5 w-3.5" />
            Select Symptoms
          </Label>

          {/* Symptom Chips */}
          <div className="flex flex-wrap gap-2">
            {commonSymptoms.map((symptom) => {
              const isSelected = selectedSymptoms.includes(symptom);
              return (
                <button
                  key={symptom}
                  type="button"
                  onClick={() => handleSymptomToggle(symptom)}
                  disabled={isLoading}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  {symptom}
                </button>
              );
            })}
          </div>

          {/* Custom Symptom */}
          <div className="flex gap-2 pt-1">
            <Input
              value={customSymptom}
              onChange={(e) => setCustomSymptom(e.target.value)}
              placeholder="Add custom symptom..."
              disabled={isLoading}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomSymptom())}
              className="h-10 rounded-xl border-gray-200 bg-white text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCustomSymptom}
              disabled={isLoading || !customSymptom.trim()}
              className="h-10 px-3 rounded-xl border-gray-200"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Selected Tags */}
          {selectedSymptoms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedSymptoms.map((symptom) => (
                <span
                  key={symptom}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold"
                >
                  {symptom}
                  <button
                    type="button"
                    onClick={() => handleSymptomToggle(symptom)}
                    disabled={isLoading}
                    className="ml-0.5 hover:text-red-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="p-5 pt-0 bg-gray-50/30">
          <Button
            type="submit"
            size="lg"
            disabled={isLoading || !patientName || !age || !gender || selectedSymptoms.length === 0}
            className="w-full h-13 text-base font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200/50 transition-all duration-300"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Get AI Recommendations
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};