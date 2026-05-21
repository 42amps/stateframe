import { z } from "zod";

import { TaskDomainSchema } from "../../../lib/domain/task-state-ledger";
import {
  createCommitWithItems,
  createTask,
  listTasks,
} from "../../../lib/db/task-state-ledger-repository";

const CreateTaskRequestSchema = z.object({
  title: z.string().min(1),
  objective: z.string().min(1),
  domain: TaskDomainSchema,
  tags: z.array(z.string()).default([]),
});

export async function GET() {
  try {
    return Response.json(await listTasks());
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const input = CreateTaskRequestSchema.parse(await request.json());
    const task = await createTask({
      ...input,
      status: "active",
    });

    await createCommitWithItems({
      commit: {
        task_id: task.id,
        parent_commit_id: null,
        author_type: "human",
        author_id: "local-user",
        session_tool: "manual",
        summary: "Task created",
        requested_next_action: null,
        raw_context_ref: null,
      },
      items: [],
    });

    return Response.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Task request failed validation.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return jsonError(error, 500);
  }
}

function jsonError(error: unknown, status: number) {
  return Response.json(
    {
      error: error instanceof Error ? error.message : "Unexpected task error.",
      issues: [],
    },
    { status },
  );
}
