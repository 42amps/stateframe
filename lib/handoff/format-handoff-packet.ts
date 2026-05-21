import {
  stateItemTypeValues,
  type HandoffPacket,
  type StateItem,
  type StateItemType,
} from "../domain/task-state-ledger";

const stateItemTypeHeadings: Record<StateItemType, string> = {
  decision: "Decisions",
  rejected_option: "Rejected Options",
  artifact: "Artifacts",
  blocker: "Blockers",
  assumption: "Assumptions",
  open_question: "Open Questions",
  resolved_question: "Resolved Questions",
  next_step: "Next Steps",
  context_fact: "Context Facts",
};

export function formatHandoffPacketAsJson(packet: HandoffPacket): string {
  return JSON.stringify(packet, null, 2);
}

export function formatHandoffPacketAsMarkdown(packet: HandoffPacket): string {
  const lines: string[] = [
    `# ${packet.task_title}`,
    "",
    `**Objective:** ${packet.objective}`,
    `**Status:** ${packet.status}`,
    `**Generated:** ${packet.generated_at}`,
    `**Generated for:** ${packet.generated_for}`,
    "",
    "## Locked State",
    "",
  ];

  for (const type of stateItemTypeValues) {
    lines.push(`### ${stateItemTypeHeadings[type]}`);
    lines.push("");
    lines.push(formatItems(packet.locked_state[type] ?? []));
    lines.push("");
  }

  lines.push("## Recent Changes");
  lines.push("");
  lines.push("### Commits");
  lines.push("");
  lines.push(formatCommits(packet.recent_changes.commits));
  lines.push("");
  lines.push("### New Items");
  lines.push("");
  lines.push(formatItems(packet.recent_changes.new_items));
  lines.push("");
  lines.push("### Deprecated Items");
  lines.push("");
  lines.push(formatItems(packet.recent_changes.deprecated_items));
  lines.push("");
  lines.push("## Packet Metadata");
  lines.push("");
  lines.push(`- Token estimate: ${packet.token_estimate}`);
  lines.push(
    `- Confidence floor: ${packet.confidence_floor ?? "No locked items"}`,
  );

  return lines.join("\n").trimEnd();
}

function formatItems(items: StateItem[]): string {
  if (items.length === 0) {
    return "_None._";
  }

  return items
    .map((item) => {
      const lines = [
        `- ${item.content}`,
        item.rationale ? `  - Rationale: ${item.rationale}` : null,
        `  - Confidence: ${item.confidence}`,
        `  - Provenance: ${item.provenance}`,
      ].filter((line): line is string => line !== null);

      return lines.join("\n");
    })
    .join("\n");
}

function formatCommits(commits: HandoffPacket["recent_changes"]["commits"]): string {
  if (commits.length === 0) {
    return "_None._";
  }

  return commits
    .map(
      (commit) =>
        `- ${commit.timestamp}: ${commit.summary} (${commit.author_type}:${commit.author_id})`,
    )
    .join("\n");
}
