import { z } from "zod";

export const taskDomainValues = [
  "coding",
  "research",
  "ops",
  "writing",
  "other",
] as const;

export const taskStatusValues = [
  "active",
  "paused",
  "complete",
  "abandoned",
] as const;

export const authorTypeValues = ["agent", "human", "system"] as const;

export const stateItemTypeValues = [
  "decision",
  "rejected_option",
  "artifact",
  "blocker",
  "assumption",
  "open_question",
  "resolved_question",
  "next_step",
  "context_fact",
] as const;

export const stateItemStatusValues = [
  "provisional",
  "locked",
  "deprecated",
] as const;

export const TaskDomainSchema = z.enum(taskDomainValues);
export const TaskStatusSchema = z.enum(taskStatusValues);
export const AuthorTypeSchema = z.enum(authorTypeValues);
export const StateItemTypeSchema = z.enum(stateItemTypeValues);
export const StateItemStatusSchema = z.enum(stateItemStatusValues);

export type TaskDomain = z.infer<typeof TaskDomainSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type AuthorType = z.infer<typeof AuthorTypeSchema>;
export type StateItemType = z.infer<typeof StateItemTypeSchema>;
export type StateItemStatus = z.infer<typeof StateItemStatusSchema>;

const IdSchema = z.string().uuid();
const TimestampSchema = z.string().datetime({ offset: true });
const NullableIdSchema = IdSchema.nullable();
const ConfidenceSchema = z.number().min(0).max(1);

export const TaskSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  objective: z.string().min(1),
  domain: TaskDomainSchema,
  status: TaskStatusSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  tags: z.array(z.string()),
});

export type Task = z.infer<typeof TaskSchema>;

export const CommitSchema = z.object({
  id: IdSchema,
  task_id: IdSchema,
  parent_commit_id: NullableIdSchema,
  author_type: AuthorTypeSchema,
  author_id: z.string().min(1),
  session_tool: z.string().min(1),
  timestamp: TimestampSchema,
  summary: z.string().min(1),
  requested_next_action: z.string().min(1).nullable(),
  raw_context_ref: z.string().min(1).nullable(),
});

export type Commit = z.infer<typeof CommitSchema>;

export const StateItemSchema = z.object({
  id: IdSchema,
  task_id: IdSchema,
  introduced_in_commit: IdSchema,
  superseded_in_commit: NullableIdSchema,
  type: StateItemTypeSchema,
  content: z.string().min(1),
  rationale: z.string().min(1).nullable(),
  confidence: ConfidenceSchema,
  provenance: z.string().min(1),
  status: StateItemStatusSchema,
  correction_of: NullableIdSchema,
  created_at: TimestampSchema,
});

export type StateItem = z.infer<typeof StateItemSchema>;

export const RecentChangesSchema = z.object({
  commits: z.array(CommitSchema),
  new_items: z.array(StateItemSchema),
  deprecated_items: z.array(StateItemSchema),
});

export type RecentChanges = z.infer<typeof RecentChangesSchema>;

export const LockedStateSchema = z.record(
  StateItemTypeSchema,
  z.array(StateItemSchema),
);

export type LockedState = z.infer<typeof LockedStateSchema>;

export const HandoffPacketSchema = z.object({
  generated_at: TimestampSchema,
  generated_for: z.string().min(1),
  task_id: IdSchema,
  task_title: z.string().min(1),
  objective: z.string().min(1),
  status: TaskStatusSchema,
  locked_state: LockedStateSchema,
  recent_changes: RecentChangesSchema,
  token_estimate: z.number().int().nonnegative(),
  confidence_floor: ConfidenceSchema.nullable(),
});

export type HandoffPacket = z.infer<typeof HandoffPacketSchema>;

export function groupStateItemsByType(
  items: readonly StateItem[],
): Record<StateItemType, StateItem[]> {
  const grouped = {} as Record<StateItemType, StateItem[]>;

  for (const type of stateItemTypeValues) {
    grouped[type] = [];
  }

  for (const item of items) {
    grouped[item.type].push(item);
  }

  return grouped;
}

export function getActiveItems(items: readonly StateItem[]): StateItem[] {
  return items.filter(
    (item) => item.status !== "deprecated" && item.superseded_in_commit === null,
  );
}

export function getLockedItems(items: readonly StateItem[]): StateItem[] {
  return getActiveItems(items).filter((item) => item.status === "locked");
}

export function getLatestNextStep(
  items: readonly StateItem[],
): StateItem | undefined {
  return getActiveItems(items)
    .filter((item) => item.type === "next_step")
    .reduce<StateItem | undefined>((latest, item) => {
      if (!latest) {
        return item;
      }

      return Date.parse(item.created_at) >= Date.parse(latest.created_at)
        ? item
        : latest;
    }, undefined);
}
