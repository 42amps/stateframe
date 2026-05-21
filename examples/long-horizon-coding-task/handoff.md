# Package Stateframe for OSS release

**Objective:** Make the repository understandable as a file-first task-state ledger for long-horizon agent workflows.
**Status:** active
**Generated:** 2026-05-20T16:50:00.000Z
**Generated for:** coding agent

## Locked State

### Decisions

- The main product surface for v1 is the local file-first CLI workflow around task.ledger.json.
  - Rationale: The human explicitly said the web app can remain but should not be the focus for v1.
  - Confidence: 0.94
  - Provenance: Human direction in transcript
- Transcript extraction should write candidates.json, and a separate command should commit reviewed candidates as provisional state.
  - Rationale: Separating extraction from commit allows human review by editing the candidates file.
  - Confidence: 0.92
  - Provenance: Human requirements in transcript

### Rejected Options

- Do not build a VS Code extension in v1.
  - Rationale: The first release should prove the local file protocol and CLI workflow before editor integrations.
  - Confidence: 0.95
  - Provenance: Explicit human instruction in transcript
- Do not add auth yet.
  - Rationale: There is no hosted user model in this phase.
  - Confidence: 0.95
  - Provenance: Explicit human instruction in transcript

### Artifacts

_None._

### Blockers

_None._

### Assumptions

_None._

### Open Questions

_None._

### Resolved Questions

_None._

### Next Steps

- Create README, protocol documentation, JSON Schema, and an example handoff demonstrating rejected options.
  - Confidence: 0.94
  - Provenance: Explicit next step in transcript

### Context Facts

- The repository already contains a Next app, Supabase migration, domain model, handoff generator, and initial CLI commands.
  - Confidence: 0.9
  - Provenance: Agent summary accepted by human

## Recent Changes

### Commits

- 2026-05-20T16:30:00.000Z: Task created (human:example-user)
- 2026-05-20T16:45:00.000Z: The session clarified that the project is pivoting toward a file-first CLI/protocol workflow, with transcript extraction and OSS packaging prioritized over web UI work. (agent:extractor)
- 2026-05-20T16:50:00.000Z: Locked reviewed state for handoff (human:example-user)

### New Items

- The main product surface for v1 is the local file-first CLI workflow around task.ledger.json.
  - Rationale: The human explicitly said the web app can remain but should not be the focus for v1.
  - Confidence: 0.94
  - Provenance: Human direction in transcript
- Do not build a VS Code extension in v1.
  - Rationale: The first release should prove the local file protocol and CLI workflow before editor integrations.
  - Confidence: 0.95
  - Provenance: Explicit human instruction in transcript
- Do not add auth yet.
  - Rationale: There is no hosted user model in this phase.
  - Confidence: 0.95
  - Provenance: Explicit human instruction in transcript
- The repository already contains a Next app, Supabase migration, domain model, handoff generator, and initial CLI commands.
  - Confidence: 0.9
  - Provenance: Agent summary accepted by human
- Transcript extraction should write candidates.json, and a separate command should commit reviewed candidates as provisional state.
  - Rationale: Separating extraction from commit allows human review by editing the candidates file.
  - Confidence: 0.92
  - Provenance: Human requirements in transcript
- Create README, protocol documentation, JSON Schema, and an example handoff demonstrating rejected options.
  - Confidence: 0.94
  - Provenance: Explicit next step in transcript

### Deprecated Items

_None._

## Packet Metadata

- Token estimate: 860
- Confidence floor: 0.9
