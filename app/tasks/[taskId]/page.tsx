"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  title: string;
  objective: string;
  domain: string;
  status: string;
};

type Commit = {
  id: string;
};

type StateItem = {
  id: string;
  type: string;
  content: string;
  rationale: string | null;
  confidence: number;
  provenance: string;
  status: "provisional" | "locked" | "deprecated";
};

type TaskDetailResponse = {
  task: Task;
  commits: Commit[];
  state_items: StateItem[];
};

export default function TaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const taskId = params.taskId;
  const [data, setData] = useState<TaskDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadTask() {
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}`);

      if (!response.ok) {
        throw new Error("Unable to load task.");
      }

      setData((await response.json()) as TaskDetailResponse);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load task.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTask();
    // The route param is the only external input for reloading this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, StateItem[]>();

    for (const item of data?.state_items ?? []) {
      groups.set(item.type, [...(groups.get(item.type) ?? []), item]);
    }

    return [...groups.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [data?.state_items]);

  async function updateItemStatus(item: StateItem) {
    const action = item.status === "locked" ? "unlock" : "lock";
    setActiveItemId(item.id);
    setError(null);

    try {
      const response = await fetch(`/api/state-items/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`Unable to ${action} item.`);
      }

      await loadTask();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update item.",
      );
    } finally {
      setActiveItemId(null);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-5xl rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          Loading task...
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-900 bg-red-950/60 p-6 text-red-200">
          {error ?? "Task not found."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Link href="/" className="text-sm font-medium text-cyan-200">
          Back to tasks
        </Link>

        <header className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/40">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
                Task Ledger
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                {data.task.title}
              </h1>
              <p className="mt-4 max-w-3xl text-slate-300">
                {data.task.objective}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/tasks/${data.task.id}/session/new`}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
              >
                Add Session
              </Link>
              <Link
                href={`/tasks/${data.task.id}/handoff`}
                className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Generate Handoff
              </Link>
            </div>
          </div>

          <dl className="mt-8 grid gap-3 sm:grid-cols-3">
            <Metric label="Domain" value={data.task.domain} />
            <Metric label="Status" value={data.task.status} />
            <Metric label="Commits" value={String(data.commits.length)} />
          </dl>
        </header>

        {error ? (
          <p className="rounded-2xl border border-red-900 bg-red-950/60 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">State Items</h2>
              <p className="mt-2 text-sm text-slate-400">
                Grouped dynamically from the item types stored in the ledger.
              </p>
            </div>
            <p className="text-sm text-slate-400">
              {data.state_items.length} total
            </p>
          </div>

          {data.state_items.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-300">
              No state items yet. Add a reviewed session later to populate this
              ledger.
            </div>
          ) : (
            <div className="mt-6 grid gap-6">
              {groupedItems.map(([type, items]) => (
                <section key={type} className="grid gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
                    {formatType(type)}
                  </h3>
                  <div className="grid gap-3">
                    {items.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                                {item.type}
                              </span>
                              <StatusBadge status={item.status} />
                            </div>
                            <p className="mt-4 text-lg text-slate-100">
                              {item.content}
                            </p>
                            {item.rationale ? (
                              <p className="mt-3 text-sm text-slate-400">
                                Rationale: {item.rationale}
                              </p>
                            ) : null}
                            <p className="mt-3 text-sm text-slate-500">
                              Confidence {item.confidence} · {item.provenance}
                            </p>
                          </div>

                          {item.status !== "deprecated" ? (
                            <button
                              type="button"
                              onClick={() => updateItemStatus(item)}
                              disabled={activeItemId === item.id}
                              className="rounded-full border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {activeItemId === item.id
                                ? "Updating..."
                                : item.status === "locked"
                                  ? "Unlock"
                                  : "Lock"}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-lg font-semibold text-slate-100">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: StateItem["status"] }) {
  const className =
    status === "locked"
      ? "bg-emerald-300/10 text-emerald-200"
      : status === "deprecated"
        ? "bg-rose-300/10 text-rose-200"
        : "bg-amber-300/10 text-amber-200";

  return (
    <span className={`rounded-full px-3 py-1 text-xs ${className}`}>
      {status}
    </span>
  );
}

function formatType(type: string): string {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
