"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Provider = "gemini" | "openrouter" | "ollama";
type ReviewStatus = "pending" | "approved" | "edited_approved" | "rejected";

type Task = {
  id: string;
  title: string;
  objective: string;
};

type TaskDetailResponse = {
  task: Task;
};

type CandidateStateItem = {
  client_id: string;
  type: string;
  content: string;
  rationale: string | null;
  confidence: number;
  provenance: string;
};

type ExtractionResult = {
  session_summary: string;
  requested_next_action: string | null;
  items: CandidateStateItem[];
};

type ReviewItem = CandidateStateItem & {
  review_status: ReviewStatus;
  edited_content: string;
  edited_rationale: string;
};

const providers: Provider[] = ["gemini", "openrouter", "ollama"];

export default function NewSessionPage() {
  const params = useParams<{ taskId: string }>();
  const router = useRouter();
  const taskId = params.taskId;
  const [task, setTask] = useState<Task | null>(null);
  const [transcript, setTranscript] = useState("");
  const [sessionTool, setSessionTool] = useState("");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState("");
  const [extractionResult, setExtractionResult] =
    useState<ExtractionResult | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [isLoadingTask, setIsLoadingTask] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTask() {
      try {
        const response = await fetch(`/api/tasks/${taskId}`);

        if (!response.ok) {
          throw new Error("Unable to load task.");
        }

        const data = (await response.json()) as TaskDetailResponse;

        if (isMounted) {
          setTask(data.task);
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load task.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingTask(false);
        }
      }
    }

    loadTask();

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  const groupedReviewItems = useMemo(() => {
    const groups = new Map<string, ReviewItem[]>();

    for (const item of reviewItems) {
      groups.set(item.type, [...(groups.get(item.type) ?? []), item]);
    }

    return [...groups.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [reviewItems]);

  const counts = useMemo(
    () => ({
      pending: reviewItems.filter((item) => item.review_status === "pending")
        .length,
      approved: reviewItems.filter(
        (item) => item.review_status === "approved",
      ).length,
      edited_approved: reviewItems.filter(
        (item) => item.review_status === "edited_approved",
      ).length,
      rejected: reviewItems.filter((item) => item.review_status === "rejected")
        .length,
    }),
    [reviewItems],
  );
  const committableItems = reviewItems.filter(
    (item) =>
      item.review_status === "approved" ||
      item.review_status === "edited_approved",
  );

  async function handleExtract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsExtracting(true);

    try {
      const response = await fetch(`/api/tasks/${taskId}/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript,
          sessionTool: sessionTool.trim() || null,
          provider,
          model: model.trim() || null,
        }),
      });
      const data = (await response.json()) as ExtractionResult | {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          "error" in data && data.error ? data.error : "Extraction failed.",
        );
      }

      const result = data as ExtractionResult;
      setExtractionResult(result);
      setReviewItems(
        result.items.map((item) => ({
          ...item,
          review_status: "pending",
          edited_content: item.content,
          edited_rationale: item.rationale ?? "",
        })),
      );
      setTranscript("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Extraction failed.",
      );
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleCommit() {
    if (!extractionResult || committableItems.length === 0) {
      return;
    }

    setError(null);
    setIsCommitting(true);

    try {
      const response = await fetch(`/api/tasks/${taskId}/commits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_summary: extractionResult.session_summary,
          requested_next_action: extractionResult.requested_next_action,
          session_tool: sessionTool.trim() || null,
          items: committableItems.map((item) => ({
            client_id: item.client_id,
            type: item.type,
            content:
              item.review_status === "edited_approved"
                ? item.edited_content
                : item.content,
            rationale:
              item.review_status === "edited_approved"
                ? item.edited_rationale.trim() || null
                : item.rationale,
            confidence: item.confidence,
            provenance: item.provenance,
          })),
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to commit approved items.");
      }

      router.push(`/tasks/${taskId}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to commit approved items.",
      );
    } finally {
      setIsCommitting(false);
    }
  }

  function updateReviewItem(
    clientId: string,
    update: Partial<Pick<ReviewItem, "review_status" | "edited_content" | "edited_rationale">>,
  ) {
    setReviewItems((currentItems) =>
      currentItems.map((item) =>
        item.client_id === clientId ? { ...item, ...update } : item,
      ),
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Link
          href={`/tasks/${taskId}`}
          className="text-sm font-medium text-cyan-200"
        >
          Back to task
        </Link>

        <header className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/40">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
            Add Session
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            {isLoadingTask ? "Loading task..." : task?.title ?? "Task"}
          </h1>
          {task ? (
            <p className="mt-4 max-w-3xl text-slate-300">{task.objective}</p>
          ) : null}
        </header>

        {error ? (
          <p className="rounded-2xl border border-red-900 bg-red-950/60 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="flex items-center gap-3">
            <StepBadge active={!extractionResult}>1</StepBadge>
            <div>
              <h2 className="text-2xl font-semibold">Paste Transcript</h2>
              <p className="mt-1 text-sm text-slate-400">
                The transcript is sent only to extraction and is cleared after a
                successful extraction.
              </p>
            </div>
          </div>

          <form onSubmit={handleExtract} className="mt-6 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-200">
                Transcript
              </span>
              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                required={!extractionResult}
                rows={10}
                placeholder="Paste the agent session transcript here..."
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Session tool
                </span>
                <input
                  value={sessionTool}
                  onChange={(event) => setSessionTool(event.target.value)}
                  placeholder="manual, chat, agent runner..."
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Provider
                </span>
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value as Provider)}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300"
                >
                  {providers.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Model optional
                </span>
                <input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="provider model override"
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={isExtracting || transcript.trim().length === 0}
              className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExtracting ? "Extracting..." : "Extract state"}
            </button>
          </form>
        </section>

        {extractionResult ? (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex items-center gap-3">
              <StepBadge active>2</StepBadge>
              <div>
                <h2 className="text-2xl font-semibold">Review Candidates</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Approve, edit, or reject extracted state before committing it
                  to the ledger.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <InfoPanel
                label="Session summary"
                value={extractionResult.session_summary}
              />
              <InfoPanel
                label="Requested next action"
                value={extractionResult.requested_next_action ?? "None"}
              />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <CountBadge label="Pending" value={counts.pending} />
              <CountBadge label="Approved" value={counts.approved} />
              <CountBadge
                label="Edited approved"
                value={counts.edited_approved}
              />
              <CountBadge label="Rejected" value={counts.rejected} />
            </div>

            {reviewItems.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-300">
                No candidate state items were extracted.
              </div>
            ) : (
              <div className="mt-6 grid gap-6">
                {groupedReviewItems.map(([type, items]) => (
                  <section key={type} className="grid gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
                      {formatType(type)}
                    </h3>
                    <div className="grid gap-3">
                      {items.map((item) => (
                        <article
                          key={item.client_id}
                          className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                                  {item.type}
                                </span>
                                <ReviewBadge status={item.review_status} />
                              </div>

                              {item.review_status === "edited_approved" ? (
                                <div className="mt-4 grid gap-3">
                                  <label className="grid gap-2">
                                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                      Content
                                    </span>
                                    <textarea
                                      value={item.edited_content}
                                      onChange={(event) =>
                                        updateReviewItem(item.client_id, {
                                          edited_content: event.target.value,
                                        })
                                      }
                                      rows={3}
                                      className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300"
                                    />
                                  </label>
                                  <label className="grid gap-2">
                                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                      Rationale
                                    </span>
                                    <textarea
                                      value={item.edited_rationale}
                                      onChange={(event) =>
                                        updateReviewItem(item.client_id, {
                                          edited_rationale: event.target.value,
                                        })
                                      }
                                      rows={2}
                                      className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300"
                                    />
                                  </label>
                                </div>
                              ) : (
                                <>
                                  <p className="mt-4 text-lg text-slate-100">
                                    {item.content}
                                  </p>
                                  {item.rationale ? (
                                    <p className="mt-3 text-sm text-slate-400">
                                      Rationale: {item.rationale}
                                    </p>
                                  ) : null}
                                </>
                              )}

                              <p className="mt-3 text-sm text-slate-500">
                                Confidence {item.confidence} -{" "}
                                {item.provenance}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  updateReviewItem(item.client_id, {
                                    review_status: "approved",
                                  })
                                }
                                className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-300 hover:text-slate-950"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateReviewItem(item.client_id, {
                                    review_status: "edited_approved",
                                    edited_content: item.edited_content,
                                    edited_rationale: item.edited_rationale,
                                  })
                                }
                                className="rounded-full border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateReviewItem(item.client_id, {
                                    review_status: "rejected",
                                  })
                                }
                                className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-300 hover:text-slate-950"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {extractionResult ? (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <StepBadge active={committableItems.length > 0}>3</StepBadge>
                <div>
                  <h2 className="text-2xl font-semibold">Commit</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Only approved and edited-approved items will be committed as
                    provisional state.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCommit}
                disabled={isCommitting || committableItems.length === 0}
                className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCommitting
                  ? "Committing..."
                  : `Commit approved items (${committableItems.length})`}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function StepBadge({ active, children }: { active: boolean; children: string }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        active ? "bg-cyan-300 text-slate-950" : "bg-slate-800 text-slate-400"
      }`}
    >
      {children}
    </span>
  );
}

function InfoPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-slate-200">{value}</p>
    </div>
  );
}

function CountBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ReviewBadge({ status }: { status: ReviewStatus }) {
  const className =
    status === "approved"
      ? "bg-emerald-300/10 text-emerald-200"
      : status === "edited_approved"
        ? "bg-cyan-300/10 text-cyan-200"
        : status === "rejected"
          ? "bg-rose-300/10 text-rose-200"
          : "bg-amber-300/10 text-amber-200";

  return (
    <span className={`rounded-full px-3 py-1 text-xs ${className}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function formatType(type: string): string {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
