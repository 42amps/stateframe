# Stateframe Protocol Notes

Stateframe uses a portable local JSON file named `task.ledger.json`. It is not an official standard or protocol; it is an experimental file format for preserving task state across long-running agent sessions.

## `task.ledger.json`

The file contains three top-level keys:

```json
{
  "task": {},
  "commits": [],
  "state_items": []
}
```

- `task` describes the durable objective.
- `commits` record append-only changes to state.
- `state_items` contain discrete facts, decisions, questions, blockers, rejected options, artifacts, and next steps.

## Append-Only Commits

Each state change is recorded by a new commit. A commit points to its parent commit, making the ledger easy to inspect and replay.

State items are not deleted in normal operation. If state becomes obsolete, a later item can supersede it and the older item can be marked `deprecated`.

## State Item Statuses

### `provisional`

Candidate state. Useful, but not yet trusted as canonical.

### `locked`

Trusted state. Locked items are the only state items included in the locked-state section of handoff packets.

### `deprecated`

Historical state that has been superseded or should no longer guide the agent.

## Why Handoffs Use Locked State

Agents are good at producing candidate summaries, but not every candidate deserves to guide future work. Handoffs use locked state so a human or trusted workflow can decide what becomes canonical.

This keeps handoff packets compact and reduces the chance that speculative or low-quality extraction becomes future instruction.

## Why Rejected Options Matter

Long-running agent work often fails by retrying approaches that were already ruled out. A `rejected_option` preserves:

- What was considered
- Why it was rejected
- When that rejection entered the ledger

This is especially useful for deferred features, scope cuts, integrations, and implementation paths that look tempting to a fresh agent.

## Why Raw Transcripts Are Not Stored

Raw transcripts are noisy, large, and often contain irrelevant conversation. The ledger stores extracted state, not chat history.

If a system wants to retain transcripts, it should store them separately and reference them from commits. The default file-first workflow does not store raw transcripts in `task.ledger.json`.
