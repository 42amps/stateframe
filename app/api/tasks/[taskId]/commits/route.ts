import { z } from "zod";

import {
  createCommitWithItems,
  getCommitsForTask,
  getTaskById,
} from "../../../../../lib/db/task-state-ledger-repository";
import { CandidateStateItemSchema } from "../../../../../lib/extraction/task-state-extractor";

const TaskIdSchema = z.string().uuid();

const CommitReviewedCandidatesRequestSchema = z.object({
  session_summary: z.string().min(1),
  requested_next_action: z.string().min(1).nullable(),
  session_tool: z.string().min(1).nullable(),
  items: z.array(CandidateStateItemSchema).min(1),
});

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
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

    const input = CommitReviewedCandidatesRequestSchema.parse(
      await request.json(),
    );
    const commits = await getCommitsForTask(taskId);
    const latestCommit = commits.at(-1);
    const result = await createCommitWithItems({
      commit: {
        task_id: taskId,
        parent_commit_id: latestCommit?.id ?? null,
        author_type: "agent",
        author_id: "extractor",
        session_tool: input.session_tool ?? "unknown",
        summary: input.session_summary,
        requested_next_action: input.requested_next_action,
        raw_context_ref: null,
      },
      items: input.items.map((item) => ({
        type: item.type,
        content: item.content,
        rationale: item.rationale,
        confidence: item.confidence,
        provenance: item.provenance,
        superseded_in_commit: null,
        status: "provisional",
        correction_of: null,
      })),
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Commit request failed validation.",
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
            : "Unexpected commit creation error.",
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
