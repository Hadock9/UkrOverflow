import './geminiDnsBootstrap.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();

/** Чи налаштовано Gemini (ключ у .env). Сервер стартує навіть без ключа. */
export function isGeminiConfigured() {
  return Boolean(GEMINI_API_KEY);
}

export function getGeminiApiKey() {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Відсутній GEMINI_API_KEY у .env. Додайте ключ: https://aistudio.google.com/apikey'
    );
  }
  return GEMINI_API_KEY;
}

export const flashModelId = process.env.AI_MODEL_FLASH?.trim() || 'gemini-2.5-flash';
export const proModelId = process.env.AI_MODEL_PRO?.trim() || 'gemini-2.5-pro';

export const flashGenerationConfig = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 2048,
};

export const proGenerationConfig = {
  temperature: 0.8,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
};

export const safetySettings = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
];

export default {
  safetySettings,
  flashModelId,
  proModelId,
  isGeminiConfigured,
};
