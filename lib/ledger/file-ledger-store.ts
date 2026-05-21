import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { z } from "zod";

import {
  CommitSchema,
  StateItemSchema,
  TaskDomainSchema,
  TaskSchema,
  type AuthorType,
  type Commit,
  type StateItem,
  type StateItemType,
  type Task,
  type TaskDomain,
} from "../domain/task-state-ledger";

export const DEFAULT_LEDGER_FILE = "task.ledger.json";

export const LedgerFileSchema = z.object({
  task: TaskSchema,
  commits: z.array(CommitSchema),
  state_items: z.array(StateItemSchema),
});

export type LedgerFile = z.infer<typeof LedgerFileSchema>;

export type CreateInitialLedgerInput = {
  title: string;
  objective: string;
  domain: TaskDomain;
  tags?: string[];
};

export type AppendCommitInput = {
  author_type?: AuthorType;
  author_id?: string;
  session_tool?: string;
  summary: string;
  requested_next_action?: string | null;
  raw_context_ref?: string | null;
};

export type AppendStateItemInput = {
  type: StateItemType;
  content: string;
  rationale?: string | null;
  confidence?: number;
  provenance?: string;
  status?: StateItem["status"];
  correction_of?: string | null;
  superseded_in_commit?: string | null;
};

export async function readLedgerFile(
  path = DEFAULT_LEDGER_FILE,
): Promise<LedgerFile> {
  const raw = await readFile(path, "utf8");
  return LedgerFileSchema.parse(JSON.parse(raw));
}

export async function writeLedgerFile(
  path: string,
  ledger: LedgerFile,
): Promise<void> {
  const parsedLedger = LedgerFileSchema.parse(ledger);
  await writeFile(path, `${JSON.stringify(parsedLedger, null, 2)}\n`, "utf8");
}

export function createInitialLedger(input: CreateInitialLedgerInput): LedgerFile {
  const now = new Date().toISOString();
  const task: Task = {
    id: randomUUID(),
    title: input.title,
    objective: input.objective,
    domain: TaskDomainSchema.parse(input.domain),
    status: "active",
    created_at: now,
    updated_at: now,
    tags: input.tags ?? [],
  };
  const rootCommit: Commit = {
    id: randomUUID(),
    task_id: task.id,
    parent_commit_id: null,
    author_type: "human",
    author_id: "local-cli",
    session_tool: "cli",
    timestamp: now,
    summary: "Task created",
    requested_next_action: null,
    raw_context_ref: null,
  };

  return LedgerFileSchema.parse({
    task,
    commits: [rootCommit],
    state_items: [],
  });
}

export function appendCommitWithItems(
  ledger: LedgerFile,
  commitInput: AppendCommitInput,
  items: AppendStateItemInput[],
): LedgerFile {
  const parsedLedger = LedgerFileSchema.parse(ledger);
  const now = new Date().toISOString();
  const parentCommit = parsedLedger.commits.at(-1);
  const commit: Commit = {
    id: randomUUID(),
    task_id: parsedLedger.task.id,
    parent_commit_id: parentCommit?.id ?? null,
    author_type: commitInput.author_type ?? "human",
    author_id: commitInput.author_id ?? "local-cli",
    session_tool: commitInput.session_tool ?? "cli",
    timestamp: now,
    summary: commitInput.summary,
    requested_next_action: commitInput.requested_next_action ?? null,
    raw_context_ref: commitInput.raw_context_ref ?? null,
  };
  const stateItems: StateItem[] = items.map((item) =>
    StateItemSchema.parse({
      id: randomUUID(),
      task_id: parsedLedger.task.id,
      introduced_in_commit: commit.id,
      superseded_in_commit: item.superseded_in_commit ?? null,
      type: item.type,
      content: item.content,
      rationale: item.rationale ?? null,
      confidence: item.confidence ?? 0.8,
      provenance: item.provenance ?? "manual CLI entry",
      status: item.status ?? "provisional",
      correction_of: item.correction_of ?? null,
      created_at: now,
    }),
  );

  return LedgerFileSchema.parse({
    ...parsedLedger,
    task: {
      ...parsedLedger.task,
      updated_at: now,
    },
    commits: [...parsedLedger.commits, commit],
    state_items: [...parsedLedger.state_items, ...stateItems],
  });
}
