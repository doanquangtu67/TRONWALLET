import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiClient;
};

export const askGeminiAssistant = async (
  prompt: string, 
  context?: string
): Promise<string> => {
  try {
    const client = getAiClient();
    
    const systemInstruction = `
      You are a friendly Blockchain expert and knowledgeable about the TRON network.
      The user is using a Tron Testnet Wallet (Shasta).
      Your task is to explain concepts (e.g., Private Key, Address, TRX, Bandwidth, Energy) simply.
      Always remind the user about security (never share Private Keys).
      Keep answers concise (under 150 words unless asked for details).
    `;

    const fullPrompt = context 
      ? `Current Context: ${context}\n\nUser Question: ${prompt}`
      : prompt;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "Sorry, I cannot answer right now.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "An error occurred while connecting to the AI assistant.";
  }
};