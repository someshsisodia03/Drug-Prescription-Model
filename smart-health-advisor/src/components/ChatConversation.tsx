import { useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot,
  User,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { MedicineRecommendation } from "@/components/MedicineRecommendation";
import {
  chatWithBackend,
  ChatResponse,
  Recommendation,
} from "@/lib/recommendationEngine";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "bot" | "user" | "system";
  content: string;
  candidates?: { medicine: string; score: number; diseases: string }[];
  followUpQuestions?: string[];
  symptomMapping?: Record<string, string[]>;
  recommendations?: Recommendation[];
  disclaimer?: string;
  model?: { name: string; library: string; features: number; corpus: number };
}

interface ChatConversationProps {
  initialSymptoms: string[];
  age: number;
  gender: string;
  patientName: string;
  onNewSearch: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const ChatConversation = ({
  initialSymptoms,
  age,
  gender,
  patientName,
  onNewSearch,
}: ChatConversationProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isResolved, setIsResolved] = useState(false);
  const [pendingQuestions, setPendingQuestions] = useState<string[]>([]);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<
    Record<string, "yes" | "no">
  >({});
  const [started, setStarted] = useState(false);

  // Use refs to avoid stale closures when clicking rapidly
  const confirmedRef = useRef<string[]>(initialSymptoms);
  const deniedRef = useRef<string[]>([]);
  const answeredRef = useRef<Record<string, "yes" | "no">>({});
  const roundRef = useRef(0);
  // Stores frozen answers per message ID so old rounds keep their Yes/No marks
  const frozenAnswersRef = useRef<Record<string, Record<string, "yes" | "no">>>({});

  const addMessage = useCallback((msg: Omit<ChatMessage, "id">) => {
    const newMsg = { ...msg, id: `msg-${Date.now()}-${Math.random()}` };
    setMessages((prev) => [...prev, newMsg]);
    return newMsg;
  }, []);

  const sendChatRequest = useCallback(async (
    currentConfirmed: string[],
    currentDenied: string[],
    round: number
  ) => {
    setIsLoading(true);

    const response = await chatWithBackend({
      confirmed: currentConfirmed,
      denied: currentDenied,
      age,
      gender,
      round,
    });

    setIsLoading(false);

    if (!response) {
      addMessage({
        role: "system",
        content:
          "ML backend is offline. Please start the Python backend with: python backend/app.py",
      });
      return;
    }

    handleChatResponse(response);
  }, [age, gender, addMessage]);

  const handleChatResponse = useCallback((response: ChatResponse) => {
    // Show symptom mapping if any
    if (
      response.symptomMapping &&
      Object.keys(response.symptomMapping).length > 0
    ) {
      const mappings = Object.entries(response.symptomMapping)
        .map(([from, to]) => `"${from}" → ${to.join(", ")}`)
        .join(" | ");
      addMessage({
        role: "system",
        content: `Symptom mapping applied: ${mappings}`,
        symptomMapping: response.symptomMapping,
      });
    }

    if (response.status === "no_match") {
      addMessage({
        role: "bot",
        content:
          response.message ||
          "The symptoms don't match our dataset. Please consult a healthcare professional.",
      });
      setIsResolved(true);
      return;
    }

    if (response.status === "resolved") {
      addMessage({
        role: "bot",
        content:
          "Based on the symptom analysis, here are the recommended medicines:",
        recommendations: response.recommendations,
        disclaimer: response.disclaimer,
        model: response.model,
      });
      setIsResolved(true);
      return;
    }

    if (response.status === "needs_more_info") {
      const newMsg = addMessage({
        role: "bot",
        content: response.message || "I need more information to narrow down.",
        candidates: response.candidates,
        followUpQuestions: response.followUpQuestions,
      });
      const newQuestions = response.followUpQuestions || [];
      setPendingQuestions(newQuestions);
      setPendingMessageId(newMsg.id);
      setAnsweredQuestions({});
      answeredRef.current = {};
    }
  }, [addMessage]);

  const startConversation = () => {
    setStarted(true);

    addMessage({
      role: "user",
      content: `Patient: ${patientName} | Age: ${age} | Gender: ${gender} | Symptoms: ${initialSymptoms.join(", ")}`,
    });

    addMessage({
      role: "bot",
      content: "Analyzing your symptoms with our AI model...",
    });

    const round = 1;
    setCurrentRound(round);
    roundRef.current = round;
    sendChatRequest(confirmedRef.current, deniedRef.current, round);
  };

  const handleSymptomAnswer = (symptom: string, answer: "yes" | "no") => {
    // Update ref immediately to avoid stale closure issues
    answeredRef.current = { ...answeredRef.current, [symptom]: answer };
    setAnsweredQuestions({ ...answeredRef.current });

    if (answer === "yes") {
      confirmedRef.current = [...confirmedRef.current, symptom];
    } else {
      deniedRef.current = [...deniedRef.current, symptom];
    }

    // Check if all questions are answered using the ref (always fresh)
    const allAnswered = pendingQuestions.every((q) => answeredRef.current[q]);

    if (allAnswered) {
      const roundConfirmed = pendingQuestions.filter(
        (q) => answeredRef.current[q] === "yes"
      );
      const roundDenied = pendingQuestions.filter(
        (q) => answeredRef.current[q] === "no"
      );

      const yesItems = roundConfirmed.length > 0
        ? `Yes: ${roundConfirmed.join(", ")}`
        : "";
      const noItems = roundDenied.length > 0
        ? `No: ${roundDenied.join(", ")}`
        : "";
      const responseText = [yesItems, noItems].filter(Boolean).join(" | ");

      addMessage({
        role: "user",
        content: responseText || "Answered all questions",
      });

      // Freeze current answers into the message so old rounds stay marked
      if (pendingMessageId) {
        frozenAnswersRef.current[pendingMessageId] = { ...answeredRef.current };
      }

      const nextRound = roundRef.current + 1;
      setCurrentRound(nextRound);
      roundRef.current = nextRound;
      setPendingQuestions([]);
      setPendingMessageId(null);
      sendChatRequest(confirmedRef.current, deniedRef.current, nextRound);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (!started) {
    return (
      <div className="space-y-4">
        <Card className="p-6 shadow-card">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <h3 className="text-lg font-bold text-foreground">
                Ready to Analyze
              </h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  <strong>Patient:</strong> {patientName}
                </p>
                <p>
                  <strong>Age:</strong> {age} | <strong>Gender:</strong>{" "}
                  {gender}
                </p>
                <p>
                  <strong>Symptoms:</strong> {initialSymptoms.join(", ")}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                The AI will analyze these symptoms and may ask follow-up
                questions to narrow down the most precise medicine
                recommendation.
              </p>
              <Button onClick={startConversation} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Start AI Diagnosis
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chat messages */}
      {messages.map((msg) => (
        <div key={msg.id} className="space-y-3">
          {/* Message bubble */}
          <div
            className={`flex gap-3 ${
              msg.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            {/* Avatar */}
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                msg.role === "bot"
                  ? "bg-primary/10"
                  : msg.role === "user"
                  ? "bg-secondary"
                  : "bg-yellow-500/10"
              }`}
            >
              {msg.role === "bot" ? (
                <Bot className="h-4 w-4 text-primary" />
              ) : msg.role === "user" ? (
                <User className="h-4 w-4 text-secondary-foreground" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              )}
            </div>

            {/* Content */}
            <div
              className={`max-w-[85%] ${
                msg.role === "user" ? "text-right" : ""
              }`}
            >
              <Card
                className={`p-4 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : msg.role === "system"
                    ? "bg-yellow-500/10 border-yellow-500/20"
                    : "bg-card"
                }`}
              >
                <p
                  className={`text-sm ${
                    msg.role === "system" ? "text-yellow-700" : ""
                  }`}
                >
                  {msg.content}
                </p>
              </Card>

              {/* Candidates preview */}
              {msg.candidates && msg.candidates.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Current Candidates
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {msg.candidates.map((c) => (
                      <Badge
                        key={c.medicine}
                        variant="outline"
                        className="text-xs py-1 px-2"
                      >
                        {c.medicine}{" "}
                        <span className="ml-1 font-mono text-primary">
                          {(c.score * 100).toFixed(0)}%
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up questions (interactive chips) */}
              {msg.followUpQuestions &&
                msg.followUpQuestions.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Do you experience these symptoms?
                    </p>
                    <div className="space-y-2">
                      {msg.followUpQuestions.map((q) => {
                        // Use frozen answers for old messages, live state for current
                        const isCurrentMessage = msg.id === pendingMessageId;
                        const frozen = frozenAnswersRef.current[msg.id];
                        const answer = isCurrentMessage
                          ? answeredQuestions[q]
                          : frozen?.[q];
                        return (
                          <div
                            key={q}
                            className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
                              answer === "yes"
                                ? "bg-green-500/10 border-green-500/30"
                                : answer === "no"
                                ? "bg-red-500/10 border-red-500/30"
                                : "bg-muted/50 border-border hover:border-primary/30"
                            }`}
                          >
                            <span className="text-sm font-medium text-foreground">
                              {q}
                            </span>
                            {!answer && msg.id === pendingMessageId ? (
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  data-symptom={q}
                                  data-answer="yes"
                                  className="h-10 px-5 text-sm font-semibold rounded-md border-2 border-green-500/40 text-green-600 bg-white hover:bg-green-500/10 flex items-center gap-2 transition-colors disabled:opacity-50"
                                  onClick={() =>
                                    handleSymptomAnswer(q, "yes")
                                  }
                                  disabled={isLoading}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  data-symptom={q}
                                  data-answer="no"
                                  className="h-10 px-5 text-sm font-semibold rounded-md border-2 border-red-500/40 text-red-600 bg-white hover:bg-red-500/10 flex items-center gap-2 transition-colors disabled:opacity-50"
                                  onClick={() =>
                                    handleSymptomAnswer(q, "no")
                                  }
                                  disabled={isLoading}
                                >
                                  <XCircle className="h-4 w-4" />
                                  No
                                </button>
                              </div>
                            ) : (
                              <Badge
                                variant={
                                  answer === "yes"
                                    ? ("success" as any)
                                    : ("destructive" as any)
                                }
                                className="text-xs"
                              >
                                {answer === "yes" ? "Yes" : "No"}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Final recommendations */}
              {msg.recommendations && msg.recommendations.length > 0 && (
                <div className="mt-4 space-y-4">
                  {/* Model info */}
                  {msg.model && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-700">
                      <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        Powered by <strong>{msg.model.name}</strong> (
                        {msg.model.library}) ·{" "}
                        {msg.model.features.toLocaleString()} AI features ·{" "}
                        {msg.model.corpus} medicines
                      </span>
                    </div>
                  )}

                  <MedicineRecommendation
                    recommendations={msg.recommendations}
                    disclaimer={
                      msg.disclaimer ||
                      "Always consult a healthcare professional."
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <Card className="p-4 bg-card">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing symptoms...
            </div>
          </Card>
        </div>
      )}

      {/* New search button */}
      {isResolved && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={onNewSearch}
            className="px-6 py-3 font-semibold"
          >
            New Patient Analysis
          </Button>
        </div>
      )}
    </div>
  );
};
