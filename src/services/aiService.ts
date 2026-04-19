import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedPrescription } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export async function parsePrescriptionFromVoice(transcript: string): Promise<ExtractedPrescription> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: transcript,
    config: {
      systemInstruction: `You are a highly precise medical documentation assistant for Kalyani Hospital. 
      Your task is to accurately extract ALL symptoms, ALL clinical diagnoses, and the COMPLETE therapeutic regimen (medicines) mentioned in the provided consultation transcript.
      
      CRITICAL RULES:
      1. COMPREHENSIVENESS: scan the entire transcript. Do not miss any mentioned medicines. If 5 medicines are discussed, all 5 must be in the list.
      2. SYSTEMATIC FORMATTING: ensure each medicine has a name, dosage (e.g., 500mg), frequency (e.g., BD, TDS, 1-0-1), and duration (e.g., 5 days).
      3. CHIEF COMPLAINTS: extract all symptoms mentioned by the patient or noted by the doctor.
      4. DIAGNOSIS: capture the definitive diagnosis or clinical impressions.
      5. SEPARATE ROWS: every unique medicine must be its own object in the array.
      6. Return ONLY a valid JSON object matching the provided schema.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          symptoms: { type: Type.STRING },
          diagnosis: { type: Type.STRING },
          medicines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                dosage: { type: Type.STRING },
                frequency: { type: Type.STRING },
                duration: { type: Type.STRING }
              },
              required: ["name"]
            }
          }
        },
        required: ["symptoms", "diagnosis", "medicines"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Failed to extract data from speech");
  return JSON.parse(text) as ExtractedPrescription;
}

export async function hospitalChatbot(query: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: query,
    config: {
      systemInstruction: `You are the AI assistant for Kalyani Hospital. 
      Hospital timings: 9 AM to 9 PM, Monday to Saturday. Sunday Emergency only.
      Booking process: Users can book via our website or call +91 1234567890.
      IMPORTANT: You are a general assistant, not a doctor. DO NOT provide medical diagnoses or medical advice. 
      If asked for a diagnosis, advise them to visit the hospital for a professional checkup.`
    }
  });
  return response.text || "I'm sorry, I couldn't process that request.";
}
