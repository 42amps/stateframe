import { z } from "zod";

import {
  getCommitsForTask,
  getStateItemsForTask,
  getTaskById,
} from "../../../../lib/db/task-state-ledger-repository";

const TaskIdSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const taskId = await getTaskId(context);
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

    return Response.json({
      task,
      commits,
      state_items: stateItems,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Task id failed validation.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected task get error.",
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
