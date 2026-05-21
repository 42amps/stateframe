#!/usr/bin/env node
import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { z } from "zod";

import {
  CandidateStateItemSchema,
  extractTaskStateFromTranscript,
} from "../lib/extraction/task-state-extractor";
import {
  getLatestNextStep,
  stateItemTypeValues,
  type StateItem,
  type StateItemType,
  type TaskDomain,
  taskDomainValues,
} from "../lib/domain/task-state-ledger";
import { formatHandoffPacketAsJson, formatHandoffPacketAsMarkdown } from "../lib/handoff/format-handoff-packet";
import { generateHandoffPacket } from "../lib/handoff/generate-handoff-packet";
import {
  DEFAULT_LEDGER_FILE,
  appendCommitWithItems,
  createInitialLedger,
  readLedgerFile,
  writeLedgerFile,
  type LedgerFile,
} from "../lib/ledger/file-ledger-store";
import { validateLedger } from "../lib/ledger/validate-ledger";

type ParsedArgs = {
  positionals: string[];
  flags: Record<string, string | boolean>;
};

async function main(argv: string[]) {
  const [command, ...rest] = argv;

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "init") {
    await initCommand(parseArgs(rest));
    return;
  }

  if (command === "status") {
    await statusCommand();
    return;
  }

  if (command === "add") {
    await addCommand(parseArgs(rest));
    return;
  }

  if (command === "lock") {
    await lockCommand(parseArgs(rest));
    return;
  }

  if (command === "unlock") {
    await unlockCommand(parseArgs(rest));
    return;
  }

  if (command === "handoff") {
    await handoffCommand(parseArgs(rest));
    return;
  }

  if (command === "extract") {
    await extractCommand(parseArgs(rest));
    return;
  }

  if (command === "commit-candidates") {
    await commitCandidatesCommand(parseArgs(rest));
    return;
  }

  if (command === "demo") {
    await demoCommand(parseArgs(rest));
    return;
  }

  if (command === "validate") {
    await validateCommand(parseArgs(rest));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function initCommand(args: ParsedArgs) {
  const [title] = args.positionals;
  const objective = getStringFlag(args, "objective");
  const domain = getStringFlag(args, "domain") as TaskDomain | undefined;

  if (!title) {
    throw new Error('Usage: stateframe init "Task title" --objective "Task objective" --domain coding');
  }

  if (!objective) {
    throw new Error("Missing required --objective.");
  }

  if (!domain || !taskDomainValues.includes(domain)) {
    throw new Error(`--domain must be one of: ${taskDomainValues.join(", ")}`);
  }

  if (!args.flags.force && (await exists(DEFAULT_LEDGER_FILE))) {
    throw new Error(`${DEFAULT_LEDGER_FILE} already exists. Use --force to overwrite.`);
  }

  const ledger = createInitialLedger({ title, objective, domain });
  await writeLedgerFile(DEFAULT_LEDGER_FILE, ledger);
  console.log(`Created ${DEFAULT_LEDGER_FILE}`);
  console.log(`Task: ${ledger.task.title}`);
}

async function statusCommand() {
  const ledger = await readLedgerFile();
  const counts = countItems(ledger.state_items);
  const nextStep = getLatestNextStep(ledger.state_items);

  printTitle("Stateframe Status");
  console.log(ledger.task.title);
  console.log(`Objective: ${ledger.task.objective}`);
  console.log(`Domain: ${ledger.task.domain}`);
  console.log(`Status: ${ledger.task.status}`);
  console.log("");
  console.log(`Commits: ${ledger.commits.length}`);
  console.log(`State items: ${ledger.state_items.length}`);
  console.log(`Locked: ${counts.locked}`);
  console.log(`Provisional: ${counts.provisional}`);
  console.log(`Deprecated: ${counts.deprecated}`);
  console.log(`Latest next step: ${nextStep?.content ?? "None"}`);
}

async function addCommand(args: ParsedArgs) {
  const [type, ...contentParts] = args.positionals;
  const content = contentParts.join(" ");

  if (!isStateItemType(type) || !content) {
    throw new Error(`Usage: stateframe add <type> "content". Types: ${stateItemTypeValues.join(", ")}`);
  }

  const confidence = getNumberFlag(args, "confidence") ?? 0.8;

  if (confidence < 0 || confidence > 1) {
    throw new Error("--confidence must be between 0 and 1.");
  }

  const ledger = await readLedgerFile();
  const nextLedger = appendCommitWithItems(
    ledger,
    {
      summary: `Added ${type}`,
    },
    [
      {
        type,
        content,
        rationale: getStringFlag(args, "rationale") ?? null,
        confidence,
        provenance: getStringFlag(args, "provenance") ?? "manual CLI entry",
        status: "provisional",
      },
    ],
  );
  const item = nextLedger.state_items.at(-1);
  await writeLedgerFile(DEFAULT_LEDGER_FILE, nextLedger);
  console.log(`Added ${type}: ${item?.id}`);
}

async function lockCommand(args: ParsedArgs) {
  const [target] = args.positionals;

  if (!target) {
    throw new Error("Usage: stateframe lock <state_item_id|all>");
  }

  const ledger = await readLedgerFile();
  const nextLedger =
    target === "all" ? lockAllItems(ledger) : lockOneItem(ledger, target);
  await writeLedgerFile(DEFAULT_LEDGER_FILE, nextLedger);
  console.log(target === "all" ? "Locked provisional items." : `Locked ${target}`);
}

async function unlockCommand(args: ParsedArgs) {
  const [itemId] = args.positionals;

  if (!itemId) {
    throw new Error("Usage: stateframe unlock <state_item_id>");
  }

  const ledger = await readLedgerFile();
  const target = ledger.state_items.find((item) => item.id === itemId);

  if (!target) {
    throw new Error(`State item not found: ${itemId}`);
  }

  if (target.status !== "locked") {
    throw new Error(`State item is not locked: ${itemId}`);
  }

  const nextLedger = appendStatusCommit(ledger, `Unlocked state item ${itemId}`);
  nextLedger.state_items = nextLedger.state_items.map((item) =>
    item.id === itemId ? { ...item, status: "provisional" } : item,
  );
  await writeLedgerFile(DEFAULT_LEDGER_FILE, nextLedger);
  console.log(`Unlocked ${itemId}`);
}

async function handoffCommand(args: ParsedArgs) {
  const format = getStringFlag(args, "format") ?? "markdown";

  if (format !== "markdown" && format !== "json") {
    throw new Error("--format must be markdown or json.");
  }

  const ledger = await readLedgerFile();
  const packet = generateHandoffPacket({
    task: ledger.task,
    commits: ledger.commits,
    stateItems: ledger.state_items,
    generatedFor: getStringFlag(args, "generated-for") ?? "agent",
  });
  const output =
    format === "json"
      ? formatHandoffPacketAsJson(packet)
      : formatHandoffPacketAsMarkdown(packet);
  const outPath = getStringFlag(args, "out");

  if (outPath) {
    await writeFile(outPath, `${output}\n`, "utf8");
    console.log(`Wrote ${outPath}`);
    return;
  }

  console.log(output);
}

async function extractCommand(args: ParsedArgs) {
  const [transcriptFile] = args.positionals;
  const provider = getStringFlag(args, "provider");

  if (!transcriptFile || !provider) {
    throw new Error("Usage: stateframe extract <transcript-file> --provider <gemini|openrouter|ollama> [--model model-name] [--out candidates.json]");
  }

  if (provider !== "gemini" && provider !== "openrouter" && provider !== "ollama") {
    throw new Error("--provider must be gemini, openrouter, or ollama.");
  }

  const ledger = await readLedgerFile();
  const transcript = await readFile(transcriptFile, "utf8");
  const result = await extractTaskStateFromTranscript({
    transcript,
    sessionTool: "manual-transcript",
    provider,
    model: getStringFlag(args, "model") ?? null,
  });
  const outputPath = getStringFlag(args, "out") ?? "candidates.json";
  const candidates = CandidatesFileSchema.parse({
    task_id: ledger.task.id,
    created_at: new Date().toISOString(),
    session_tool: "manual-transcript",
    session_summary: result.session_summary,
    requested_next_action: result.requested_next_action,
    items: result.items,
  });

  await writeFile(outputPath, `${JSON.stringify(candidates, null, 2)}\n`, "utf8");
  console.log(`Session summary: ${candidates.session_summary}`);
  console.log(`Requested next action: ${candidates.requested_next_action ?? "None"}`);
  console.log(`Candidates extracted: ${candidates.items.length}`);
  console.log(`Output: ${outputPath}`);
}

async function commitCandidatesCommand(args: ParsedArgs) {
  const [candidatesFile] = args.positionals;

  if (!candidatesFile) {
    throw new Error("Usage: stateframe commit-candidates <candidates-file>");
  }

  const ledger = await readLedgerFile();
  const candidates = CandidatesFileSchema.parse(
    JSON.parse(await readFile(candidatesFile, "utf8")),
  );

  if (candidates.task_id !== ledger.task.id) {
    throw new Error("Candidates file task_id does not match current ledger task.");
  }

  if (candidates.items.length === 0) {
    throw new Error("Candidates file must contain at least one item.");
  }

  const nextLedger = appendCommitWithItems(
    ledger,
    {
      author_type: "agent",
      author_id: "extractor",
      session_tool: candidates.session_tool,
      summary: candidates.session_summary,
      requested_next_action: candidates.requested_next_action,
      raw_context_ref: null,
    },
    candidates.items.map((item) => ({
      type: item.type,
      content: item.content,
      rationale: item.rationale,
      confidence: item.confidence,
      provenance: item.provenance,
      status: "provisional",
      correction_of: null,
      superseded_in_commit: null,
    })),
  );
  const committedItems = nextLedger.state_items.slice(-candidates.items.length);

  await writeLedgerFile(DEFAULT_LEDGER_FILE, nextLedger);
  console.log(`Committed ${committedItems.length} items:`);
  for (const item of committedItems) {
    console.log(`- ${item.id}`);
  }
}

async function demoCommand(args: ParsedArgs) {
  const outputDir = getStringFlag(args, "dir") ?? "ledger-demo";
  const sourceDir = await findDemoSourceDir();

  if ((await exists(outputDir)) && !args.flags.force) {
    throw new Error(`${outputDir} already exists. Use --force to overwrite.`);
  }

  if (args.flags.force) {
    await rm(outputDir, { recursive: true, force: true });
  }

  await mkdir(outputDir, { recursive: true });

  const files = [
    "transcript.txt",
    "candidates.json",
    "task.ledger.json",
    "handoff.md",
  ];

  for (const file of files) {
    await cp(resolve(sourceDir, file), `${outputDir}/${file}`);
  }

  printTitle("Stateframe Demo");
  console.log(`Created demo ledger in ${outputDir}`);
  console.log("");
  console.log("Files created:");
  for (const file of files) {
    console.log(`- ${outputDir}/${file}`);
  }
  console.log("");
  console.log(`Inspect the handoff: ${outputDir}/handoff.md`);
  console.log(
    "Suggested next step: Paste handoff.md into a fresh AI agent session and ask it to continue the task.",
  );
}

async function findDemoSourceDir(): Promise<string> {
  const cliDir =
    typeof __dirname === "string"
      ? __dirname
      : dirname(process.argv[1] ?? ".");
  const candidates = [
    resolve(cliDir, "../examples/long-horizon-coding-task"),
    resolve(cliDir, "../../examples/long-horizon-coding-task"),
  ];

  for (const candidate of candidates) {
    if (await exists(resolve(candidate, "task.ledger.json"))) {
      return candidate;
    }
  }

  throw new Error("Could not find bundled demo examples.");
}

async function validateCommand(args: ParsedArgs) {
  const ledgerPath = getStringFlag(args, "file") ?? DEFAULT_LEDGER_FILE;
  let ledger: unknown;

  try {
    ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  } catch (error) {
    console.log("Validation: failed");
    console.log(`File: ${ledgerPath}`);
    console.log(
      `Error: ${error instanceof Error ? error.message : "Could not read ledger file."}`,
    );
    process.exitCode = 1;
    return;
  }

  const result = validateLedger(ledger);

  printTitle("Stateframe Validation");
  console.log(`Validation: ${result.ok ? "ok" : "failed"}`);
  console.log(`File: ${ledgerPath}`);
  console.log(`Task: ${result.summary.taskTitle ?? "Unknown"}`);
  console.log(`Commits: ${result.summary.commits}`);
  console.log(`State items: ${result.summary.stateItems}`);
  console.log(`Locked: ${result.summary.locked}`);
  console.log(`Provisional: ${result.summary.provisional}`);
  console.log(`Deprecated: ${result.summary.deprecated}`);

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    for (const error of result.errors) {
      console.log(`- ${error}`);
    }
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

function lockOneItem(ledger: LedgerFile, itemId: string): LedgerFile {
  const target = ledger.state_items.find((item) => item.id === itemId);

  if (!target) {
    throw new Error(`State item not found: ${itemId}`);
  }

  if (target.status === "deprecated") {
    throw new Error(`Cannot lock deprecated state item: ${itemId}`);
  }

  const nextLedger = appendStatusCommit(ledger, `Locked state item ${itemId}`);
  nextLedger.state_items = nextLedger.state_items.map((item) =>
    item.id === itemId ? { ...item, status: "locked" } : item,
  );
  return nextLedger;
}

function lockAllItems(ledger: LedgerFile): LedgerFile {
  const lockableItems = ledger.state_items.filter(
    (item) => item.status === "provisional" && item.superseded_in_commit === null,
  );

  if (lockableItems.length === 0) {
    throw new Error("No provisional active state items to lock.");
  }

  const nextLedger = appendStatusCommit(
    ledger,
    `Locked ${lockableItems.length} state items`,
  );
  const lockableIds = new Set(lockableItems.map((item) => item.id));
  nextLedger.state_items = nextLedger.state_items.map((item) =>
    lockableIds.has(item.id) ? { ...item, status: "locked" } : item,
  );
  return nextLedger;
}

function appendStatusCommit(ledger: LedgerFile, summary: string): LedgerFile {
  return appendCommitWithItems(
    ledger,
    {
      summary,
      author_type: "human",
      author_id: "local-cli",
      session_tool: "cli",
    },
    [],
  );
}

function countItems(items: StateItem[]) {
  return {
    locked: items.filter((item) => item.status === "locked").length,
    provisional: items.filter((item) => item.status === "provisional").length,
    deprecated: items.filter((item) => item.status === "deprecated").length,
  };
}

function printTitle(title: string) {
  const line = "=".repeat(title.length + 4);
  console.log(line);
  console.log(`  ${title}`);
  console.log(line);
  console.log("");
}

function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const name = arg.slice(2);
    const next = args[index + 1];

    if (!next || next.startsWith("--")) {
      flags[name] = true;
      continue;
    }

    flags[name] = next;
    index += 1;
  }

  return { positionals, flags };
}

function getStringFlag(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumberFlag(args: ParsedArgs, name: string): number | undefined {
  const value = getStringFlag(args, name);
  return value === undefined ? undefined : Number(value);
}

function isStateItemType(value: string | undefined): value is StateItemType {
  return stateItemTypeValues.includes(value as StateItemType);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function printHelp() {
  printTitle("Stateframe CLI");
  console.log(`A file-first task-state ledger for long-horizon agent workflows.

Usage:
  stateframe init "Task title" --objective "Task objective" --domain coding
  stateframe status
  stateframe add decision "Use a local file ledger" --rationale "Portable across tools"
  stateframe demo [--dir ledger-demo] [--force]
  stateframe validate [--file task.ledger.json]
  stateframe extract transcript.txt --provider ollama --out candidates.json
  stateframe commit-candidates candidates.json
  stateframe lock <state_item_id>
  stateframe lock all
  stateframe unlock <state_item_id>
  stateframe handoff [--format markdown|json] [--out handoff.md]`);
}

const CandidatesFileSchema = z.object({
  task_id: z.string().uuid(),
  created_at: z.string().datetime({ offset: true }),
  session_tool: z.string().min(1),
  session_summary: z.string().min(1),
  requested_next_action: z.string().min(1).nullable(),
  items: z.array(CandidateStateItemSchema).min(1),
});

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unexpected CLI error.");
  process.exitCode = 1;
});
