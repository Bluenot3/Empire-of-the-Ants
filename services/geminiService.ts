import { GoogleGenAI } from "@google/genai";
import { Resources } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getQueenAdvice = async (resources: Resources, recentEvent: string): Promise<string> => {
  if (!process.env.API_KEY) {
    return "The Queen is silent. (Missing API Key)";
  }

  try {
    const prompt = `
      You are the Ant Queen of a growing colony.
      Current Status:
      - Food: ${resources.food}
      - Materials: ${resources.materials}
      - Population: ${resources.population}
      
      Recent event: "${recentEvent}"

      Give a short, regal, and slightly insectoid command or piece of wisdom to your subjects (the player). 
      Keep it under 2 sentences. Be immersive.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "The Queen chitters thoughtfully.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The Queen is confused by cosmic interference.";
  }
};

export const generateRandomEncounter = async (): Promise<{ title: string, description: string, reward: string }> => {
  if (!process.env.API_KEY) return { title: "Quiet Day", description: "Nothing happens.", reward: "none" };

  try {
    const prompt = `
      Generate a random mini-event for an ant colony simulation.
      Return strictly JSON with keys: "title", "description", "reward".
      The reward should be a short string description (e.g., "Found 50 food", "Lost 2 ants").
      Make it fun and weird.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    return JSON.parse(text);
  } catch (error) {
    return { title: "Static", description: "The radio is silent.", reward: "none" };
  }
};
