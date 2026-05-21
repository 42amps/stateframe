# Stateframe CLI

The CLI is the file-first product surface for a portable task-state ledger. It creates and updates a local `task.ledger.json` file that can travel with a repository, folder, or handoff bundle.

## Install And Dev Usage

Install dependencies:

```bash
npm install
```

Run the local TypeScript CLI:

```bash
npm run stateframe -- help
```

Build the packageable CLI:

```bash
npm run build:cli
node dist/cli/index.js help
```

When published, the intended usage shape is:

```bash
npx stateframe demo
stateframe demo
```

The default ledger path is `task.ledger.json` in the current directory.

## First-Run Demo

```bash
npm run stateframe -- demo
```

This creates `./ledger-demo` with:

- `transcript.txt`
- `candidates.json`
- `task.ledger.json`
- `handoff.md`

Use a custom directory:

```bash
npm run stateframe -- demo --dir /tmp/my-ledger-demo
```

If the directory exists, pass `--force` to replace it.

## Initialize A Ledger

```bash
npm run stateframe -- init "Task title" --objective "Task objective" --domain coding
```

Allowed domains are `coding`, `research`, `ops`, `writing`, and `other`.

The command creates:

- A `Task`
- A root `Commit`
- An empty `state_items` array

It will not overwrite an existing `task.ledger.json` unless `--force` is passed.

## Add State

```bash
npm run stateframe -- add decision "Use Supabase for persistence" --rationale "Relational schema fits append-only ledger" --confidence 0.9
```

```bash
npm run stateframe -- add rejected_option "Do not add auth yet" --rationale "MVP is local single-user for now"
```

Supported state item types:

- `decision`
- `rejected_option`
- `artifact`
- `blocker`
- `assumption`
- `open_question`
- `resolved_question`
- `next_step`
- `context_fact`

New items are `provisional` by default. Confidence defaults to `0.8`, and provenance defaults to `manual CLI entry`.

## Lock Trusted State

Lock one item:

```bash
npm run stateframe -- lock <state_item_id>
```

Lock all active provisional items:

```bash
npm run stateframe -- lock all
```

Locked items are the trusted state used in handoff packets. Provisional items remain in the ledger, but they are not included as locked state in generated handoffs.

## Unlock State

```bash
npm run stateframe -- unlock <state_item_id>
```

Unlocking changes a locked item back to `provisional` and records a new commit. Items are not deleted.

## Generate Handoff

Markdown is the default:

```bash
npm run stateframe -- handoff
```

Generate JSON:

```bash
npm run stateframe -- handoff --format json
```

Write output to a file:

```bash
npm run stateframe -- handoff --out handoff.md
```

Handoffs include locked state and recent changes. They are meant to be pasted into any AI agent so it can resume work without rereading a full transcript.

## Validate A Ledger

Validate the default local ledger:

```bash
npm run stateframe -- validate
```

Validate a specific file:

```bash
npm run stateframe -- validate --file path/to/task.ledger.json
```

The command checks:

- Basic schema validity
- Commit and state-item references
- Status consistency for provisional, locked, and deprecated items
- Whether handoff generation succeeds

It exits with code `0` when valid and code `1` when errors are found. Warnings are printed separately.

## Extract Candidates From A Transcript

```bash
npm run stateframe -- extract transcript.txt --provider ollama --out candidates.json
```

Supported providers are `gemini`, `openrouter`, and `ollama`. You can pass a provider-specific model override:

```bash
npm run stateframe -- extract transcript.txt --provider openrouter --model model-name
```

The command:

- Requires an existing `task.ledger.json`
- Reads the transcript from disk
- Calls the extraction provider directly
- Writes reviewable candidates to `candidates.json` by default
- Does not modify `task.ledger.json`
- Does not store the raw transcript in the ledger

The candidates file is intentionally editable. Human review can happen by editing `content`, `rationale`, or removing unwanted items before committing.

## Commit Reviewed Candidates

```bash
npm run stateframe -- commit-candidates candidates.json
```

This validates the candidates file, checks that its `task_id` matches the current ledger, and appends one commit containing all candidate items as `provisional` state. It does not lock items automatically.

## Example Workflow

```bash
npm run stateframe -- init "Launch research project" --objective "Track decisions, open questions, and handoffs" --domain research
npm run stateframe -- add context_fact "The project is in discovery phase"
npm run stateframe -- add decision "Use a local JSON ledger first" --rationale "It keeps the protocol portable"
npm run stateframe -- add rejected_option "Do not add hosted auth yet" --rationale "The first workflow is local and single-user"
npm run stateframe -- status
npm run stateframe -- lock all
npm run stateframe -- handoff --out handoff.md
```

## Transcript Extraction Workflow

```bash
npm run stateframe -- extract transcript.txt --provider ollama --out candidates.json
# edit candidates.json
npm run stateframe -- commit-candidates candidates.json
npm run stateframe -- lock all
npm run stateframe -- handoff --out handoff.md
```

## Why Locked State Matters

The ledger separates candidate or provisional state from trusted state. Agents can propose or record state freely, but only locked state is treated as canonical in handoff packets. This keeps handoffs compact and trustworthy while preserving the full append-only history.

## How This Differs From Memory Or Traces

Memory systems usually store facts, preferences, or embeddings. Trace systems record what happened. A task-state ledger stores what is true now for a task: decisions, rejected options, artifacts, blockers, assumptions, questions, next steps, and context facts. It is designed for resuming long-horizon work across sessions and agents.
