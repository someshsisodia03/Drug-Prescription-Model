import { useState, useEffect } from "react";
import { Activity, Cpu, AlertTriangle, Stethoscope, Pill, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PatientIntakeForm, PatientData } from "@/components/PatientIntakeForm";
import { ChatConversation } from "@/components/ChatConversation";
import { MedicineLookup } from "@/components/MedicineLookup";
import { useToast } from "@/hooks/use-toast";
import { checkBackendHealth } from "@/lib/recommendationEngine";

const Index = () => {
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"diagnosis" | "lookup">("diagnosis");
  const { toast } = useToast();

  useEffect(() => {
    checkBackendHealth().then(setBackendUp);
  }, []);

  const handleSubmit = (data: PatientData) => {
    if (!backendUp) {
      toast({
        title: "Backend Offline",
        description: "The AI backend must be running. Start it with: python backend/app.py",
        variant: "destructive",
      });
      return;
    }
    setPatientData(data);
  };

  const handleNewSearch = () => setPatientData(null);

  return (
    <div className="min-h-screen bg-[#f0f4ff]">
      {/* Header - Compact & Mobile Friendly */}
      <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Heart className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Smart Prescription AI</h1>
                <p className="text-[11px] text-blue-200 hidden sm:block">AI-Powered Diagnosis</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {backendUp !== null && (
                <span className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                  backendUp
                    ? "bg-emerald-500/25 text-emerald-100 border border-emerald-400/30"
                    : "bg-yellow-500/25 text-yellow-100 border border-yellow-400/30"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${backendUp ? "bg-emerald-400 animate-pulse" : "bg-yellow-400"}`} />
                  {backendUp ? "Online" : "Offline"}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Offline Warning */}
      {backendUp === false && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
          <p className="container mx-auto text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            Backend is offline. Start it with: <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">python backend/app.py</code>
          </p>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="container mx-auto px-4 max-w-2xl pt-5">
        <div className="flex gap-0 p-1 bg-white rounded-2xl shadow-xl border border-gray-100">
          <button
            onClick={() => { setActiveTab("diagnosis"); setPatientData(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeTab === "diagnosis"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Stethoscope className="h-4 w-4" />
            AI Diagnosis
          </button>
          <button
            onClick={() => setActiveTab("lookup")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeTab === "lookup"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Pill className="h-4 w-4" />
            Medicine Lookup
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {activeTab === "diagnosis" ? (
          <>
            {!patientData ? (
              <div className="space-y-5">
                <div className="text-center space-y-1 pt-2">
                  <h2 className="text-2xl font-extrabold text-gray-900">Patient Information</h2>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Enter details & select symptoms — our AI will refine the diagnosis
                  </p>
                </div>
                <PatientIntakeForm onSubmit={handleSubmit} isLoading={false} />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="text-center space-y-1 pt-2">
                  <h2 className="text-2xl font-extrabold text-gray-900">AI Diagnosis</h2>
                  <p className="text-sm text-gray-500">
                    Answer follow-up questions for precise results
                  </p>
                </div>
                <ChatConversation
                  initialSymptoms={patientData.symptoms}
                  age={patientData.age}
                  gender={patientData.gender}
                  patientName={patientData.patientName}
                  onNewSearch={handleNewSearch}
                />
              </div>
            )}
          </>
        ) : (
          <MedicineLookup />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12 py-5 bg-white/60">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-gray-400">Smart Prescription AI · AI-Powered Medicine Recommendation</p>
          <p className="text-[11px] text-gray-400 mt-1">Always consult healthcare professionals for medical decisions</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;