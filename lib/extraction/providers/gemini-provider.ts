import {
  ExtractionProviderConfigurationError,
  ExtractionProviderError,
  type ExtractionProvider,
  type ExtractionProviderOptions,
} from "./types";

declare const process: {
  env: Record<string, string | undefined>;
};

const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export function createGeminiProvider(
  options: ExtractionProviderOptions = {},
): ExtractionProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;

  if (!apiKey) {
    throw new ExtractionProviderConfigurationError(
      "GEMINI_API_KEY is required to use the Gemini extraction provider.",
    );
  }

  return {
    name: "gemini",
    async extractJson(prompt: string): Promise<string> {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model,
        )}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
        },
      );

      const data = (await response.json()) as GeminiGenerateContentResponse;

      if (!response.ok) {
        throw new ExtractionProviderError(
          data.error?.message ?? "Gemini extraction request failed.",
          "gemini",
        );
      }

      const text = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();

      if (!text) {
        throw new ExtractionProviderError(
          "Gemini returned an empty extraction response.",
          "gemini",
        );
      }

      return text;
    },
  };
}
