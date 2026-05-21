import { z } from "zod";

import {
  ExtractionProviderNameSchema,
  extractTaskStateFromTranscript,
} from "../../../../../lib/extraction/task-state-extractor";

const ExtractRouteRequestSchema = z.object({
  transcript: z.string().min(1),
  sessionTool: z.string().min(1).nullable().default(null),
  provider: ExtractionProviderNameSchema,
  model: z.string().min(1).nullable().default(null),
});

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { taskId } = await context.params;

    if (!taskId) {
      return Response.json(
        { error: "A taskId route parameter is required.", issues: [] },
        { status: 400 },
      );
    }

    const body = ExtractRouteRequestSchema.parse(await request.json());
    const result = await extractTaskStateFromTranscript(body);

    return Response.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Extraction request or model output failed validation.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Task-state extraction failed.",
        issues: [],
      },
      { status: 500 },
    );
  }
}
