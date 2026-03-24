import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing from environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey);

export async function generateGeminiResponse( userMessage: string, systemInstruction?: string ): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      ...(systemInstruction && { systemInstruction }),
    });

    // Send the user's message to the model
    const result = await model.generateContent(userMessage);
    const response = await result.response;
    
    return response.text();
    
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}