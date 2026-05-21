import { z } from "zod";

import {
  deprecateStateItem,
  lockStateItem,
  unlockStateItem,
} from "../../../../lib/db/task-state-ledger-repository";

const ItemIdSchema = z.string().uuid();

const StateItemStatusActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("lock"),
    superseded_in_commit: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("unlock"),
    superseded_in_commit: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("deprecate"),
    superseded_in_commit: z.string().uuid(),
  }),
]);

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const itemId = await getItemId(context);
    const input = StateItemStatusActionSchema.parse(await request.json());

    if (input.action === "lock") {
      return Response.json(await lockStateItem(itemId));
    }

    if (input.action === "unlock") {
      return Response.json(await unlockStateItem(itemId));
    }

    return Response.json(
      await deprecateStateItem(itemId, input.superseded_in_commit),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "State item status request failed validation.",
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
            : "Unexpected state item status error.",
        issues: [],
      },
      { status: 500 },
    );
  }
}

async function getItemId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return ItemIdSchema.parse(params.itemId);
}
