import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MedicationData {
  medicine: string;
  symptoms: Set<string>;
  diseases: Set<string>;
  riskFactors: Set<string>;
  contraindications: Set<string>;
  ageRestrictions: Set<string>;
  pregnancyWarnings: Set<string>;
  sources: Set<string>;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function calculateSafetyScore(medicine: string, riskFactors: Set<string>, contraindications: Set<string>): number {
  let score = 100;
  
  // Reduce score based on number of risk factors
  score -= riskFactors.size * 3;
  
  // Reduce more for serious contraindications
  score -= contraindications.size * 5;
  
  // Specific risk reductions
  const riskText = Array.from(riskFactors).join(' ').toLowerCase();
  if (riskText.includes('elderly')) score -= 5;
  if (riskText.includes('pregnancy')) score -= 5;
  if (riskText.includes('bleeding')) score -= 8;
  if (riskText.includes('kidney') || riskText.includes('renal')) score -= 7;
  if (riskText.includes('liver') || riskText.includes('hepatic')) score -= 7;
  if (riskText.includes('anticoagulant')) score -= 6;
  
  // Well-known safe medicines get bonus
  const safeMeds = ['paracetamol', 'acetaminophen', 'loratadine'];
  if (safeMeds.some(m => medicine.toLowerCase().includes(m))) score += 10;
  
  return Math.max(50, Math.min(100, score));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvData } = await req.json();
    
    if (!csvData) {
      throw new Error('No CSV data provided');
    }

    console.log('Processing medication dataset...');

    // Parse CSV
    const lines = csvData.trim().split('\n');
    const headers = parseCSVLine(lines[0]);
    
    console.log('Headers:', headers);
    
    // Expected columns: Name, DateOfBirth, Gender, Symptoms, Causes, Disease, Medicine, RiskFactors, SourceReference
    const medicationMap = new Map<string, MedicationData>();

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      if (values.length < 7) continue;
      
      const symptoms = values[3]?.split(',').map(s => s.trim()).filter(Boolean) || [];
      const disease = values[5]?.trim();
      const medicine = values[6]?.trim();
      const riskFactors = values[7]?.trim();
      
      if (!medicine) continue;
      
      // Get or create medicine entry
      let medData = medicationMap.get(medicine);
      if (!medData) {
        medData = {
          medicine,
          symptoms: new Set(),
          diseases: new Set(),
          riskFactors: new Set(),
          contraindications: new Set(),
          ageRestrictions: new Set(),
          pregnancyWarnings: new Set(),
          sources: new Set()
        };
        medicationMap.set(medicine, medData);
      }
      
      // Aggregate data
      symptoms.forEach(s => medData!.symptoms.add(s));
      if (disease) medData.diseases.add(disease);
      
      // Parse risk factors
      if (riskFactors) {
        if (riskFactors.toLowerCase().includes('elderly')) {
          medData.ageRestrictions.add('Elderly patients require dose adjustment');
        }
        if (riskFactors.toLowerCase().includes('pregnancy')) {
          medData.pregnancyWarnings.add('Use with caution in pregnancy');
        }
        if (riskFactors.toLowerCase().includes('allergic to')) {
          medData.contraindications.add(riskFactors);
        }
        if (riskFactors.toLowerCase().includes('avoid')) {
          medData.contraindications.add(riskFactors);
        }
        if (riskFactors.toLowerCase().includes('anticoagulant')) {
          medData.riskFactors.add('Drug interactions with anticoagulants');
        }
        
        medData.riskFactors.add(riskFactors);
      }
    }

    console.log(`Processed ${medicationMap.size} unique medicines`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Prepare records for insertion
    const medicationRecords = Array.from(medicationMap.values()).map(med => {
      const safetyScore = calculateSafetyScore(
        med.medicine,
        med.riskFactors,
        med.contraindications
      );
      
      return {
        name: med.medicine,
        symptoms: Array.from(med.symptoms),
        diseases: Array.from(med.diseases),
        risk_factors: Array.from(med.riskFactors),
        contraindications: Array.from(med.contraindications),
        age_restrictions: Array.from(med.ageRestrictions).join('; ') || null,
        pregnancy_category: Array.from(med.pregnancyWarnings).length > 0 ? 'Caution advised' : 'Consult doctor',
        safety_score: safetyScore,
        dosage: 'Consult healthcare provider for proper dosage',
        active_ingredients: [med.medicine], // Simplified - could be enhanced
        side_effects: ['Consult drug information leaflet'],
        interactions: []
      };
    });

    console.log(`Inserting ${medicationRecords.length} medications...`);

    // Insert in batches of 10 to avoid timeouts
    const batchSize = 10;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < medicationRecords.length; i += batchSize) {
      const batch = medicationRecords.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('medications')
        .insert(batch);
      
      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    console.log(`Successfully inserted ${inserted} medications, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted,
        errors,
        total: medicationRecords.length,
        message: `Loaded ${inserted} unique medicines from dataset`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in load-medication-data function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});