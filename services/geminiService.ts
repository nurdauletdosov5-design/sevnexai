import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

// Coding Guidelines:
// - Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
// - The API key must be obtained exclusively from the environment variable process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let chatSession: Chat | null = null;

const getChatSession = () => {
  if (!chatSession) {
    chatSession = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7, 
      },
    });
  }
  return chatSession;
};

// Text and Vision Chat
export const streamMessage = async (
  message: string,
  imageAttachment: { mimeType: string; data: string } | undefined,
  onChunk: (text: string) => void
): Promise<string> => {
  try {
    let completeText = "";
    
    // Agar rasm bo'lsa, chat sessiyasini emas, to'g'ridan-to'g'ri modelni ishlatamiz
    // Sababi: chat.sendMessageStream hozirda multimodal inputni to'g'ridan-to'g'ri qo'llab-quvvatlamasligi mumkin
    if (imageAttachment) {
      
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { 
              inlineData: { 
                mimeType: imageAttachment.mimeType, 
                data: imageAttachment.data 
              } 
            },
            { text: message || "Bu rasmda nima tasvirlangan?" }
          ]
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          completeText += text;
          onChunk(text);
        }
      }

    } else {
      // Faqat matn bo'lsa, chat sessiyasidan foydalanamiz (contextni saqlash uchun)
      const chat = getChatSession();
      const result = await chat.sendMessageStream({ message });

      for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        const text = c.text;
        if (text) {
          completeText += text;
          onChunk(text);
        }
      }
    }
    
    return completeText;

  } catch (error) {
    console.error("Error streaming message:", error);
    throw error;
  }
};

// Image Generation
export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: prompt }
        ]
      }
    });

    for (const candidate of response.candidates || []) {
        for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return part.inlineData.data;
            }
        }
    }
    
    throw new Error("Rasm yaratilmadi. Javobda rasm ma'lumoti yo'q.");

  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};

export const resetChat = () => {
  chatSession = null;
};