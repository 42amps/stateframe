import { z } from "zod";

import { generateHandoffPacket } from "../handoff/generate-handoff-packet";
import { LedgerFileSchema, type LedgerFile } from "./file-ledger-store";

export type LedgerValidationSummary = {
  taskTitle: string | null;
  commits: number;
  stateItems: number;
  locked: number;
  provisional: number;
  deprecated: number;
};

export type LedgerValidationResult = {
  ok: boolean;
  summary: LedgerValidationSummary;
  errors: string[];
  warnings: string[];
};

export function validateLedger(input: unknown): LedgerValidationResult {
  const parsed = LedgerFileSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      summary: emptySummary(),
      errors: formatZodIssues(parsed.error),
      warnings: [],
    };
  }

  const ledger = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];
  const commitIds = new Set(ledger.commits.map((commit) => commit.id));
  const itemIds = new Set(ledger.state_items.map((item) => item.id));

  if (!ledger.task.id) {
    errors.push("task.id is required.");
  }

  for (const commit of ledger.commits) {
    if (commit.task_id !== ledger.task.id) {
      errors.push(`commit ${commit.id} task_id does not match ledger task.id.`);
    }

    if (commit.parent_commit_id && !commitIds.has(commit.parent_commit_id)) {
      errors.push(`commit ${commit.id} parent_commit_id references missing commit ${commit.parent_commit_id}.`);
    }
  }

  for (const item of ledger.state_items) {
    if (item.task_id !== ledger.task.id) {
      errors.push(`state_item ${item.id} task_id does not match ledger task.id.`);
    }

    if (!commitIds.has(item.introduced_in_commit)) {
      errors.push(`state_item ${item.id} introduced_in_commit references missing commit ${item.introduced_in_commit}.`);
    }

    if (item.superseded_in_commit && !commitIds.has(item.superseded_in_commit)) {
      errors.push(`state_item ${item.id} superseded_in_commit references missing commit ${item.superseded_in_commit}.`);
    }

    if (item.correction_of && !itemIds.has(item.correction_of)) {
      errors.push(`state_item ${item.id} correction_of references missing state item ${item.correction_of}.`);
    }

    if (item.status === "deprecated" && item.superseded_in_commit === null) {
      errors.push(`deprecated state_item ${item.id} must have superseded_in_commit.`);
    }

    if (item.status !== "deprecated" && item.superseded_in_commit !== null) {
      warnings.push(`non-deprecated state_item ${item.id} has superseded_in_commit set.`);
    }
  }

  try {
    generateHandoffPacket({
      task: ledger.task,
      commits: ledger.commits,
      stateItems: ledger.state_items,
    });
  } catch (error) {
    errors.push(
      `handoff generation failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  return {
    ok: errors.length === 0,
    summary: summarizeLedger(ledger),
    errors,
    warnings,
  };
}

function summarizeLedger(ledger: LedgerFile): LedgerValidationSummary {
  return {
    taskTitle: ledger.task.title,
    commits: ledger.commits.length,
    stateItems: ledger.state_items.length,
    locked: ledger.state_items.filter((item) => item.status === "locked").length,
    provisional: ledger.state_items.filter((item) => item.status === "provisional").length,
    deprecated: ledger.state_items.filter((item) => item.status === "deprecated").length,
  };
}

function emptySummary(): LedgerValidationSummary {
  return {
    taskTitle: null,
    commits: 0,
    stateItems: 0,
    locked: 0,
    provisional: 0,
    deprecated: 0,
  };
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "ledger";
    return `${path}: ${issue.message}`;
  });
}
