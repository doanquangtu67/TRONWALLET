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
      Bạn là một chuyên gia Blockchain thân thiện và am hiểu về mạng TRON.
      Người dùng đang sử dụng ứng dụng Ví Tron Testnet (Shasta).
      Nhiệm vụ của bạn là giải thích các khái niệm (ví dụ: Private Key, Address, TRX, Bandwidth, Energy) một cách dễ hiểu bằng Tiếng Việt.
      Luôn nhắc nhở người dùng về bảo mật (không chia sẻ Private Key).
      Hãy giữ câu trả lời ngắn gọn, súc tích (dưới 150 từ trừ khi được yêu cầu chi tiết).
    `;

    const fullPrompt = context 
      ? `Ngữ cảnh hiện tại: ${context}\n\nCâu hỏi của người dùng: ${prompt}`
      : prompt;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "Xin lỗi, tôi không thể trả lời lúc này.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Đã xảy ra lỗi khi kết nối với trợ lý ảo.";
  }
};