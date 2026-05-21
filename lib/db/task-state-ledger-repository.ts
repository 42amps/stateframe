import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  CommitSchema,
  StateItemSchema,
  TaskSchema,
  type Commit,
  type StateItem,
  type Task,
} from "../domain/task-state-ledger";

declare const process: {
  env: Record<string, string | undefined>;
};

const IdSchema = z.string().uuid();
const NullableIdSchema = IdSchema.nullable();
const TimestampSchema = z.string().datetime({ offset: true });

export const CreateTaskInputSchema = TaskSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  id: IdSchema.optional(),
  tags: z.array(z.string()).default([]),
});

export type CreateTaskInput = z.input<typeof CreateTaskInputSchema>;

export const CreateCommitInputSchema = CommitSchema.omit({
  id: true,
  parent_commit_id: true,
  timestamp: true,
  requested_next_action: true,
  raw_context_ref: true,
}).extend({
  id: IdSchema.optional(),
  parent_commit_id: NullableIdSchema.default(null),
  timestamp: TimestampSchema.optional(),
  requested_next_action: z.string().min(1).nullable().default(null),
  raw_context_ref: z.string().min(1).nullable().default(null),
});

export const CreateStateItemInputSchema = StateItemSchema.omit({
  id: true,
  task_id: true,
  introduced_in_commit: true,
  superseded_in_commit: true,
  correction_of: true,
  created_at: true,
}).extend({
  id: IdSchema.optional(),
  superseded_in_commit: NullableIdSchema.default(null),
  correction_of: NullableIdSchema.default(null),
  created_at: TimestampSchema.optional(),
});

export const CreateCommitWithItemsInputSchema = z.object({
  commit: CreateCommitInputSchema,
  items: z.array(CreateStateItemInputSchema),
});

export type CreateCommitWithItemsInput = z.input<
  typeof CreateCommitWithItemsInputSchema
>;

export type CreateCommitWithItemsResult = {
  commit: Commit;
  items: StateItem[];
};

let supabaseServerClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (supabaseServerClient) {
    return supabaseServerClient;
  }

  const supabaseUrl = firstNonEmptyEnv([
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
  ]);
  const supabaseKey = firstNonEmptyEnv([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]);

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL and key environment variables are required.");
  }

  supabaseServerClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseServerClient;
}

function firstNonEmptyEnv(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];

    if (value) {
      return value;
    }
  }

  return undefined;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const payload = CreateTaskInputSchema.parse(input);
  const { data, error } = await getSupabaseServerClient()
    .from("tasks")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return TaskSchema.parse(data);
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const id = IdSchema.parse(taskId);
  const { data, error } = await getSupabaseServerClient()
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? TaskSchema.parse(data) : null;
}

export async function listTasks(): Promise<Task[]> {
  const { data, error } = await getSupabaseServerClient()
    .from("tasks")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return z.array(TaskSchema).parse(data ?? []);
}

export async function createCommitWithItems(
  input: CreateCommitWithItemsInput,
): Promise<CreateCommitWithItemsResult> {
  const payload = CreateCommitWithItemsInputSchema.parse(input);
  const { data, error } = await getSupabaseServerClient().rpc(
    "create_commit_with_items",
    {
      commit_record: payload.commit,
      state_item_records: payload.items,
    },
  );

  if (error) {
    throw error;
  }

  return z
    .object({
      commit: CommitSchema,
      items: z.array(StateItemSchema),
    })
    .parse(data);
}

export async function getCommitsForTask(taskId: string): Promise<Commit[]> {
  const id = IdSchema.parse(taskId);
  const { data, error } = await getSupabaseServerClient()
    .from("commits")
    .select("*")
    .eq("task_id", id)
    .order("timestamp", { ascending: true });

  if (error) {
    throw error;
  }

  return z.array(CommitSchema).parse(data ?? []);
}

export async function getStateItemsForTask(
  taskId: string,
): Promise<StateItem[]> {
  const id = IdSchema.parse(taskId);
  const { data, error } = await getSupabaseServerClient()
    .from("state_items")
    .select("*")
    .eq("task_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return z.array(StateItemSchema).parse(data ?? []);
}

export async function lockStateItem(itemId: string): Promise<StateItem> {
  return updateStateItemStatus(itemId, { status: "locked" });
}

export async function unlockStateItem(itemId: string): Promise<StateItem> {
  return updateStateItemStatus(itemId, { status: "provisional" });
}

export async function deprecateStateItem(
  itemId: string,
  supersededInCommitId: string,
): Promise<StateItem> {
  return updateStateItemStatus(itemId, {
    status: "deprecated",
    superseded_in_commit: IdSchema.parse(supersededInCommitId),
  });
}

async function updateStateItemStatus(
  itemId: string,
  update: { status: StateItem["status"]; superseded_in_commit?: string },
): Promise<StateItem> {
  const id = IdSchema.parse(itemId);
  const { data, error } = await getSupabaseServerClient()
    .from("state_items")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return StateItemSchema.parse(data);
}
