"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateGeminiResponse = generateGeminiResponse;
const generative_ai_1 = require("@google/generative-ai");
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing from environment variables.");
}
const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
async function generateGeminiResponse(userMessage, systemInstruction) {
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            ...(systemInstruction && { systemInstruction }),
        });
        // Send the user's message to the model
        const result = await model.generateContent(userMessage);
        const response = await result.response;
        return response.text();
    }
    catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
}
