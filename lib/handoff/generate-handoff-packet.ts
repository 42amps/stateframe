import {
  HandoffPacketSchema,
  groupStateItemsByType,
  type Commit,
  type HandoffPacket,
  type StateItem,
  type Task,
} from "../domain/task-state-ledger";

export type GenerateHandoffPacketInput = {
  task: Task;
  commits: Commit[];
  stateItems: StateItem[];
  generatedFor?: string;
  recentCommitCount?: number;
};

export function generateHandoffPacket(
  input: GenerateHandoffPacketInput,
): HandoffPacket {
  const recentCommitCount = input.recentCommitCount ?? 3;
  const lockedItems = input.stateItems.filter(
    (item) => item.status === "locked",
  );
  const recentCommits = [...input.commits]
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
    .slice(-recentCommitCount);
  const recentCommitIds = new Set(recentCommits.map((commit) => commit.id));
  const confidenceFloor =
    lockedItems.length > 0
      ? Math.min(...lockedItems.map((item) => item.confidence))
      : null;
  const packetWithoutEstimate = {
    generated_at: new Date().toISOString(),
    generated_for: input.generatedFor ?? "unspecified",
    task_id: input.task.id,
    task_title: input.task.title,
    objective: input.task.objective,
    status: input.task.status,
    locked_state: groupStateItemsByType(lockedItems),
    recent_changes: {
      commits: recentCommits,
      new_items: input.stateItems.filter((item) =>
        recentCommitIds.has(item.introduced_in_commit),
      ),
      deprecated_items: input.stateItems.filter(
        (item) =>
          item.superseded_in_commit !== null &&
          recentCommitIds.has(item.superseded_in_commit),
      ),
    },
    token_estimate: 0,
    confidence_floor: confidenceFloor,
  };

  return HandoffPacketSchema.parse({
    ...packetWithoutEstimate,
    token_estimate: estimateTokens(packetWithoutEstimate),
  });
}

function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}
