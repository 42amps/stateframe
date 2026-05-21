export type BuildExtractionPromptInput = {
  transcript: string;
  sessionTool: string | null;
};

export function buildExtractionPrompt(
  input: BuildExtractionPromptInput,
): string {
  const sessionTool = input.sessionTool ?? "unknown";

  return `You are a task-state extractor for long-running agent workflows.

Your job is to read a raw agent session transcript and extract candidate task-state items for later human review.

Rules:
- Extract one discrete fact per item.
- Do not create long bundled workflow items.
- Split multi-step decisions into smaller state items when each step matters independently.
- If a flow is mentioned as a whole, classify it as a concise context_fact, not a giant decision.
- Decisions must include rationale.
- Rejected options must include rationale.
- Extract rejected options aggressively when the transcript says or strongly implies an approach was ruled out.
- Extract explicit "do not build X", "do not add X", "do not use X", "not in v1", "defer X", or "out of scope" statements as rejected_option.
- Pay special attention to deferred features, integrations, auth, persistence choices, and scope cuts.
- Prefer precision over completeness.
- Do not include chat pleasantries.
- Do not include vague speculation.
- Do not include anything below 0.5 confidence.
- If unsure whether something is a decision or assumption, mark it as assumption with lower confidence.
- requested_next_action must be one concrete next action or null.
- If the transcript clearly states the next step, also include a next_step item with the same concrete action.
- Keep the extraction domain-agnostic. Do not assume the task is coding, research, ops, writing, or any other domain unless the transcript states it.
- Do not store, summarize, or quote the full transcript. Extract only durable task state.
- Return JSON only.
- Do not wrap JSON in markdown fences.

Confidence calibration:
- 0.95 is the maximum for explicitly stated ordinary transcript items.
- Use 0.85-0.94 for strongly supported items.
- Use 0.65-0.84 for implied items.
- Never output 1.0 unless the transcript contains a formal machine-readable declaration.
- Prefer lower confidence when classification is uncertain.

Artifact classification:
- Use artifact only for concrete produced outputs like files, documents, links, code modules, designs, reports, or generated deliverables.
- Use context_fact for existing project state, current implementation status, background facts, or what already exists.

Allowed item types:
- decision
- rejected_option
- artifact
- blocker
- assumption
- open_question
- resolved_question
- next_step
- context_fact

Return exactly this JSON shape:
{
  "session_summary": "1-3 sentence summary of durable state changes",
  "requested_next_action": "one concrete next action or null",
  "items": [
    {
      "type": "decision | rejected_option | artifact | blocker | assumption | open_question | resolved_question | next_step | context_fact",
      "content": "plain-language state item",
      "rationale": "why this is true or why this choice/rejection happened, or null",
      "confidence": 0.5,
      "provenance": "brief description of where this came from in the session"
    }
  ]
}

Session tool: ${sessionTool}

Transcript:
${input.transcript}`;
}
