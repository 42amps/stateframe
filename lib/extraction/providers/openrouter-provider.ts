import {
  ExtractionProviderConfigurationError,
  ExtractionProviderError,
  type ExtractionProvider,
  type ExtractionProviderOptions,
} from "./types";

declare const process: {
  env: Record<string, string | undefined>;
};

type OpenRouterChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export function createOpenRouterProvider(
  options: ExtractionProviderOptions = {},
): ExtractionProvider {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = options.model ?? process.env.OPENROUTER_MODEL;

  if (!apiKey) {
    throw new ExtractionProviderConfigurationError(
      "OPENROUTER_API_KEY is required to use the OpenRouter extraction provider.",
    );
  }

  if (!model) {
    throw new ExtractionProviderConfigurationError(
      "A model is required for OpenRouter extraction. Provide model or OPENROUTER_MODEL.",
    );
  }

  return {
    name: "openrouter",
    async extractJson(prompt: string): Promise<string> {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.1,
            response_format: {
              type: "json_object",
            },
          }),
        },
      );

      const data =
        (await response.json()) as OpenRouterChatCompletionResponse;

      if (!response.ok) {
        throw new ExtractionProviderError(
          data.error?.message ?? "OpenRouter extraction request failed.",
          "openrouter",
        );
      }

      const text = data.choices?.[0]?.message?.content?.trim();

      if (!text) {
        throw new ExtractionProviderError(
          "OpenRouter returned an empty extraction response.",
          "openrouter",
        );
      }

      return text;
    },
  };
}
