import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { GameData, Character, StoryLogEntry } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const buildContext = (gameData: GameData, activeCharacter?: Character, promptOverride?: string): string => {
  const lastLogs = gameData.storyLog.slice(-10); // Get last 10 entries
  const history = lastLogs.map(log => {
      if (log.type === 'dialogue') {
          const char = gameData.characters.find(c => c.id === log.characterId);
          return `${char?.name || 'Narrator'}: "${log.text}"`;
      }
      return '';
  }).join('\n');

  return `
    You are an expert creative writer for a collaborative visual novel.
    
    STORY PROMPT:
    ${gameData.storyPrompt}

    ${activeCharacter ? `
    YOUR CHARACTER:
    Name: ${activeCharacter.name}
    Bio: ${activeCharacter.bio}
    ` : ''}

    RECENT HISTORY:
    ${history}

    INSTRUCTION:
    ${promptOverride}
  `;
}

export const generateDialogue = async (gameData: GameData, activeCharacter: Character): Promise<string> => {
  try {
    const context = buildContext(gameData, activeCharacter, `Based on the context, write a single line of dialogue for ${activeCharacter.name}. Be creative and move the story forward. Do not surround it with quotes.`);
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: context,
        config: {
            thinkingConfig: { thinkingBudget: 0 },
            maxOutputTokens: 50,
        }
    });
    const text = response.text;
    if (!text) {
        throw new Error("AI returned an empty response for dialogue.");
    }
    return text.trim().replace(/^"|"$/g, ''); // Remove wrapping quotes
  } catch (error) {
    console.error("Error generating dialogue:", error);
    throw error;
  }
};


export const generateChoices = async (gameData: GameData): Promise<{text: string}[]> => {
    try {
        const context = buildContext(gameData, undefined, `Based on the current situation, generate 2-3 interesting and distinct choices for the next player. The choices should be short action descriptions.`);
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: context,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        choices: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: {
                                        type: Type.STRING,
                                        description: 'The text for the choice option.',
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        const jsonStr = response.text;
        if (!jsonStr) {
            return [];
        }
        const result = JSON.parse(jsonStr.trim());
        return result.choices || [];
    } catch (error) {
        console.error("Error generating choices:", error);
        throw error;
    }
};