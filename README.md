# Stateframe

[![CI](https://github.com/42amps/stateframe/actions/workflows/ci.yml/badge.svg)](https://github.com/42amps/stateframe/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A file-first task-state ledger for long-horizon agent workflows.

Status: experimental.

Long-running AI work breaks when the next session cannot tell what is true now: what was decided, what was rejected, what is blocked, and what should happen next. Stateframe stores durable task state in a portable local file, `task.ledger.json`, and generates a compact `handoff.md` packet for the next agent.

Memory remembers facts.
Traces record what happened.
Orchestration runs agents.
Stateframe preserves what is true now, what changed, what failed, and what should happen next.

```bash
npm install
npm run stateframe -- demo
cd ledger-demo
cat handoff.md
```

That creates `ledger-demo/` with a transcript, reviewable candidates, a complete `task.ledger.json`, and a generated `handoff.md`.

When published, the same CLI shape is intended to work as:

```bash
npx stateframe-cli demo
stateframe demo
```

Or create a new ledger from scratch:

```bash
npm run stateframe -- init "Ship agent handoff flow" --objective "Track durable state across sessions" --domain coding
npm run stateframe -- add rejected_option "Do not add auth yet" --rationale "The first workflow is local and single-user"
npm run stateframe -- add next_step "Generate a handoff packet for the next agent"
npm run stateframe -- lock all
npm run stateframe -- handoff --out handoff.md
```

`task.ledger.json` is the local source of truth: one task, append-only commits, and state items. `handoff.md` is the portable packet you give to any AI agent so it can resume without rereading the whole transcript.

Architecture notes live in [`docs/architecture.md`](docs/architecture.md).

## Why This Exists

Agent workflows are getting longer than one chat window. A fresh agent often repeats failed approaches, misses earlier constraints, or asks the human to re-explain decisions.

This project treats task state as a first-class artifact:

- Decisions are explicit.
- Rejected options are preserved.
- Open questions and blockers survive session boundaries.
- Trusted state is locked before it appears in handoffs.
- Raw transcripts stay outside the ledger.

## Quickstart

```bash
npm install
npm run stateframe -- help
```

Create a ledger:

```bash
npm run stateframe -- init "Task title" --objective "Task objective" --domain other
```

Add state:

```bash
npm run stateframe -- add decision "Use a local JSON ledger first" --rationale "It keeps the workflow portable"
```

Lock trusted state:

```bash
npm run stateframe -- lock all
```

Generate a handoff:

```bash
npm run stateframe -- handoff --out handoff.md
```

Validate a ledger:

```bash
npm run stateframe -- validate
```

## Core Concepts

### Task

The durable goal. Every commit and state item belongs to one task.

### Commit

An append-only record of a state change. Commits preserve when state was introduced, locked, unlocked, or otherwise changed.

### StateItem

A discrete piece of task state. Supported types are:

- `decision`
- `rejected_option`
- `artifact`
- `blocker`
- `assumption`
- `open_question`
- `resolved_question`
- `next_step`
- `context_fact`

### Lock

A human trust signal. Provisional items can be useful, but only locked state is treated as canonical in handoff packets.

### HandoffPacket

A generated packet containing locked state and recent changes. It can be emitted as Markdown or JSON.

## CLI Usage

```bash
npm run stateframe -- init "Task title" --objective "Task objective" --domain coding
npm run stateframe -- status
npm run stateframe -- add rejected_option "Do not build a browser extension in v1" --rationale "The first release should prove the file protocol"
npm run stateframe -- extract transcript.txt --provider ollama --out candidates.json
npm run stateframe -- commit-candidates candidates.json
npm run stateframe -- lock all
npm run stateframe -- validate
npm run stateframe -- handoff --format json
```

Transcript extraction is optional and provider-backed. The file-first basics do not require an LLM API key.

## Example Workflow

See [`examples/long-horizon-coding-task`](examples/long-horizon-coding-task) for:

- A messy transcript
- Extracted candidates
- A ledger with locked decisions and rejected options
- A handoff packet a coding agent could use

The example demonstrates why rejected options matter: without the ledger, a fresh agent may retry a deferred approach; with the handoff, the next agent sees the constraint before acting.

## File Format

The default local file is `task.ledger.json`:

```json
{
  "task": {},
  "commits": [],
  "state_items": []
}
```

The JSON Schema lives at [`task.ledger.schema.json`](task.ledger.schema.json). More details are in [`docs/protocol.md`](docs/protocol.md).

## Validate A Ledger

`stateframe validate` checks the local file schema, commit and state-item references, status logic, and whether a handoff packet can be generated.

```bash
npm run stateframe -- validate
npm run stateframe -- validate --file path/to/task.ledger.json
```

The command exits with code `0` when the ledger is valid and `1` when errors are found.

## How It Compares

### Memory Layers

Memory layers remember facts, preferences, or embeddings. Stateframe records task state: decisions, rejected options, blockers, questions, and next steps.

### Traces And Observability

Traces show what happened. Stateframe answers what matters now.

### Orchestration Frameworks

Orchestration frameworks run agents. Stateframe gives agents a portable state packet to resume work.

### Project Management Tools

Project management tools are human-facing work trackers. Stateframe is a compact, agent-readable state layer for handoff and continuation.

## Roadmap

- Better candidate review workflows
- CLI transcript extraction refinements
- JSON Schema versioning
- Import/export helpers
- Optional web UI polish
- Optional hosted persistence

## Status: Experimental

This is an early experimental developer tool. The local file workflow works, but the format and CLI may change as the project learns from real long-horizon agent use.
