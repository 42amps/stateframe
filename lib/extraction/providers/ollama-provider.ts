import {
  ExtractionProviderConfigurationError,
  ExtractionProviderError,
  type ExtractionProvider,
  type ExtractionProviderOptions,
} from "./types";

declare const process: {
  env: Record<string, string | undefined>;
};

type OllamaGenerateResponse = {
  response?: string;
  error?: string;
};

export function createOllamaProvider(
  options: ExtractionProviderOptions = {},
): ExtractionProvider {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = options.model ?? process.env.OLLAMA_MODEL;

  if (!model) {
    throw new ExtractionProviderConfigurationError(
      "A model is required for Ollama extraction. Provide model or OLLAMA_MODEL.",
    );
  }

  return {
    name: "ollama",
    async extractJson(prompt: string): Promise<string> {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: "json",
          options: {
            temperature: 0.1,
          },
        }),
      });

      const data = (await response.json()) as OllamaGenerateResponse;

      if (!response.ok) {
        throw new ExtractionProviderError(
          data.error ?? "Ollama extraction request failed.",
          "ollama",
        );
      }

      const text = data.response?.trim();

      if (!text) {
        throw new ExtractionProviderError(
          "Ollama returned an empty extraction response.",
          "ollama",
        );
      }

      return text;
    },
  };
}
