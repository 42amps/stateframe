"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const domains = ["coding", "research", "ops", "writing", "other"] as const;

type CreatedTask = {
  id: string;
};

export default function NewTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [domain, setDomain] = useState<(typeof domains)[number]>("other");
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          objective,
          domain,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      const data = (await response.json()) as CreatedTask | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Unable to create task.");
      }

      router.push(`/tasks/${(data as CreatedTask).id}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create task.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-medium text-cyan-200">
          Back to tasks
        </Link>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/40">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
            New Ledger
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Create Task
          </h1>
          <p className="mt-3 text-slate-300">
            Start a generic task ledger with an initial root commit.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-200">Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-200">
                Objective
              </span>
              <textarea
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                required
                rows={5}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-200">Domain</span>
              <select
                value={domain}
                onChange={(event) =>
                  setDomain(event.target.value as (typeof domains)[number])
                }
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300"
              >
                {domains.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-200">
                Tags optional
              </span>
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="planning, handoff, review"
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300"
              />
            </label>

            {error ? (
              <p className="rounded-2xl border border-red-900 bg-red-950/60 p-4 text-red-200">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating..." : "Create Task"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
