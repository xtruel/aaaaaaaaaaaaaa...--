import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

/**
 * Generates a background image using Gemini Nano Banana (Flash Image).
 */
export const generateBackgroundImage = async (prompt: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Generate a high quality, static background image for a video call. 
                   Description: ${prompt}. 
                   Style: Professional, artistic, or scenic as described. 
                   Do not include people or text.`
          }
        ]
      },
      config: {
        // Flash image model doesn't support aspect ratio config in all environments yet, 
        // but we can request 16:9 in the prompt or rely on default square and crop.
        // We will crop to fit canvas.
      }
    });

    // Extract image from response
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
           return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image data found in response.");
  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    throw error;
  }
};