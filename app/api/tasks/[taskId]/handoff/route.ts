import { z } from "zod";

import {
  getCommitsForTask,
  getStateItemsForTask,
  getTaskById,
} from "../../../../../lib/db/task-state-ledger-repository";
import { generateHandoffPacket } from "../../../../../lib/handoff/generate-handoff-packet";
import { formatHandoffPacketAsMarkdown } from "../../../../../lib/handoff/format-handoff-packet";

const TaskIdSchema = z.string().uuid();

const HandoffQuerySchema = z.object({
  format: z.enum(["markdown", "json"]).default("markdown"),
  generatedFor: z.string().min(1).optional(),
  recentCommitCount: z.coerce.number().int().positive().optional(),
});

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const taskId = await getTaskId(context);
    const query = HandoffQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const task = await getTaskById(taskId);

    if (!task) {
      return Response.json(
        {
          error: "Task not found.",
          issues: [],
        },
        { status: 404 },
      );
    }

    const [commits, stateItems] = await Promise.all([
      getCommitsForTask(taskId),
      getStateItemsForTask(taskId),
    ]);
    const packet = generateHandoffPacket({
      task,
      commits,
      stateItems,
      generatedFor: query.generatedFor,
      recentCommitCount: query.recentCommitCount,
    });

    if (query.format === "json") {
      return Response.json(packet);
    }

    return Response.json({
      format: "markdown",
      packet,
      content: formatHandoffPacketAsMarkdown(packet),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Handoff request failed validation.",
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
            : "Unexpected handoff generation error.",
        issues: [],
      },
      { status: 500 },
    );
  }
}

async function getTaskId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return TaskIdSchema.parse(params.taskId);
}
