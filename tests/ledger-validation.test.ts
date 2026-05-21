import assert from "node:assert/strict";
import test from "node:test";

import { generateHandoffPacket } from "../lib/handoff/generate-handoff-packet";
import {
  appendCommitWithItems,
  createInitialLedger,
  type LedgerFile,
} from "../lib/ledger/file-ledger-store";
import { validateLedger } from "../lib/ledger/validate-ledger";

test("creates an initial ledger that validates", () => {
  const ledger = createInitialLedger({
    title: "Validate local ledger",
    objective: "Keep task state portable",
    domain: "coding",
  });

  const result = validateLedger(ledger);

  assert.equal(result.ok, true);
  assert.equal(result.summary.commits, 1);
  assert.equal(result.summary.stateItems, 0);
});

test("adds a state item commit and locking all items validates", () => {
  const initial = createInitialLedger({
    title: "Validate locking",
    objective: "Lock trusted state",
    domain: "research",
  });
  const withItem = appendCommitWithItems(
    initial,
    { summary: "Added decision" },
    [
      {
        type: "decision",
        content: "Use a local JSON ledger",
        rationale: "It is portable across agents",
        confidence: 0.9,
        provenance: "test",
      },
    ],
  );
  const locked = lockAllForTest(withItem);

  const result = validateLedger(locked);

  assert.equal(result.ok, true);
  assert.equal(result.summary.locked, 1);
  assert.equal(result.summary.provisional, 0);
});

test("handoff excludes provisional items from locked state", () => {
  const ledger = appendCommitWithItems(
    createInitialLedger({
      title: "Validate handoff",
      objective: "Only trusted state is canonical",
      domain: "other",
    }),
    { summary: "Added mixed state" },
    [
      {
        type: "decision",
        content: "Locked state should appear",
        status: "locked",
      },
      {
        type: "next_step",
        content: "Provisional state should not appear as locked",
        status: "provisional",
      },
    ],
  );

  const packet = generateHandoffPacket({
    task: ledger.task,
    commits: ledger.commits,
    stateItems: ledger.state_items,
  });

  assert.equal((packet.locked_state.decision ?? []).length, 1);
  assert.equal((packet.locked_state.next_step ?? []).length, 0);
});

test("validate passes on a good ledger and fails on a broken commit reference", () => {
  const goodLedger = appendCommitWithItems(
    createInitialLedger({
      title: "Validate references",
      objective: "Catch broken history",
      domain: "ops",
    }),
    { summary: "Added next step" },
    [{ type: "next_step", content: "Run validation" }],
  );
  const badLedger: LedgerFile = {
    ...goodLedger,
    state_items: goodLedger.state_items.map((item) => ({
      ...item,
      introduced_in_commit: "00000000-0000-4000-8000-000000000000",
    })),
  };

  assert.equal(validateLedger(goodLedger).ok, true);

  const badResult = validateLedger(badLedger);
  assert.equal(badResult.ok, false);
  assert.match(
    badResult.errors.join("\n"),
    /introduced_in_commit references missing commit/,
  );
});

function lockAllForTest(ledger: LedgerFile): LedgerFile {
  const nextLedger = appendCommitWithItems(
    ledger,
    { summary: "Locked all provisional items" },
    [],
  );

  return {
    ...nextLedger,
    state_items: nextLedger.state_items.map((item) =>
      item.status === "provisional" ? { ...item, status: "locked" } : item,
    ),
  };
}
