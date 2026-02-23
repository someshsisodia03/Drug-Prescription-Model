import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patientName, age, gender, symptoms } = await req.json();

    console.log('Processing prescription request:', { patientName, age, gender, symptoms });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query medications that match any of the symptoms
    const { data: medications, error: dbError } = await supabase
      .from('medications')
      .select('*')
      .or(symptoms.map((s: string) => `symptoms.cs.{${s}}`).join(','));

    if (dbError) {
      console.error('Database error:', dbError);
    }

    console.log(`Found ${medications?.length || 0} matching medications`);

    // Prepare context for AI
    const medicationContext = medications && medications.length > 0
      ? medications.map(med => `
Medicine: ${med.name}
Active Ingredients: ${med.active_ingredients?.join(', ') || 'N/A'}
Symptoms Treated: ${med.symptoms?.join(', ') || 'N/A'}
Diseases: ${med.diseases?.join(', ') || 'N/A'}
Dosage: ${med.dosage || 'Standard dosage'}
Safety Score: ${med.safety_score || 75}/100
Risk Factors: ${med.risk_factors?.join(', ') || 'None'}
Interactions: ${med.interactions?.join(', ') || 'None'}
Contraindications: ${med.contraindications?.join(', ') || 'None'}
Side Effects: ${med.side_effects?.join(', ') || 'Minimal'}
Age Restrictions: ${med.age_restrictions || 'None'}
Pregnancy Category: ${med.pregnancy_category || 'Consult doctor'}
`).join('\n---\n')
      : "No medications found in database. Please provide general medical recommendations based on symptoms.";

    // Call AI Gateway
    const AI_API_KEY = Deno.env.get('AI_API_KEY');
    if (!AI_API_KEY) {
      throw new Error('AI_API_KEY not configured');
    }

    const systemPrompt = `You are an expert medical AI assistant specializing in safe prescription recommendations. 
Your role is to analyze patient information and recommend the most suitable medicines based on:
- Patient demographics (age, gender)
- Reported symptoms
- Available medication data
- Safety profiles and risk factors

CRITICAL INSTRUCTIONS:
1. Recommend 3-5 most suitable medicines from the provided dataset
2. Prioritize medicines with higher safety scores
3. Consider age restrictions and contraindications
4. Avoid medicines with conflicting active ingredients
5. For each recommendation, provide:
   - Medicine name
   - Safety score (0-100)
   - Why it's recommended
   - Important warnings or considerations
   - Dosage information

If no suitable medicines are found in the database, provide general recommendations but clearly state this is for informational purposes only.

Always include a disclaimer that recommendations should be verified with a healthcare professional.

Return your response as a JSON object with this structure:
{
  "recommendations": [
    {
      "medicine": "Medicine Name",
      "safetyScore": 85,
      "reason": "Why this medicine is recommended",
      "warnings": "Important warnings",
      "dosage": "Dosage information",
      "activeIngredients": ["ingredient1", "ingredient2"]
    }
  ],
  "disclaimer": "Consult a healthcare professional before taking any medication."
}`;

    const userPrompt = `
Patient Information:
- Name: ${patientName}
- Age: ${age} years
- Gender: ${gender}
- Symptoms: ${symptoms.join(', ')}

Available Medications:
${medicationContext}

Please analyze this patient's condition and recommend the safest and most suitable medicines.`;

    console.log('Calling AI Gateway...');

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_recommendations",
              description: "Provide medicine recommendations with safety analysis",
              parameters: {
                type: "object",
                properties: {
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        medicine: { type: "string" },
                        safetyScore: { type: "number" },
                        reason: { type: "string" },
                        warnings: { type: "string" },
                        dosage: { type: "string" },
                        activeIngredients: {
                          type: "array",
                          items: { type: "string" }
                        }
                      },
                      required: ["medicine", "safetyScore", "reason", "warnings", "dosage"],
                      additionalProperties: false
                    }
                  },
                  disclaimer: { type: "string" }
                },
                required: ["recommendations", "disclaimer"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_recommendations" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI Response received');

    // Parse the tool call response
    const toolCall = aiData.choices[0].message.tool_calls?.[0];
    let recommendations;

    if (toolCall && toolCall.function.arguments) {
      recommendations = JSON.parse(toolCall.function.arguments);
    } else {
      throw new Error('No structured response from AI');
    }

    // Save prescription to database
    const { error: insertError } = await supabase
      .from('prescriptions')
      .insert({
        patient_name: patientName,
        age: age,
        gender: gender,
        symptoms: symptoms,
        recommendations: recommendations
      });

    if (insertError) {
      console.error('Error saving prescription:', insertError);
    }

    return new Response(
      JSON.stringify(recommendations),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in recommend-medicine function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        recommendations: [],
        disclaimer: 'An error occurred. Please consult a healthcare professional.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});