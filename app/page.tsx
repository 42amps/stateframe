"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  objective: string;
  domain: string;
  status: string;
  created_at: string;
};

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTasks() {
      try {
        const response = await fetch("/api/tasks");

        if (!response.ok) {
          throw new Error("Unable to load tasks.");
        }

        const data = (await response.json()) as Task[];

        if (isMounted) {
          setTasks(data);
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load tasks.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTasks();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-slate-950/40 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
              Task-State Ledger
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              Tasks
            </h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Durable state for long-running agent work, organized by task.
            </p>
          </div>
          <Link
            href="/tasks/new"
            className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            New Task
          </Link>
        </header>

        {isLoading ? (
          <p className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
            Loading tasks...
          </p>
        ) : error ? (
          <p className="rounded-2xl border border-red-900 bg-red-950/60 p-6 text-red-200">
            {error}
          </p>
        ) : tasks.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 p-10 text-center">
            <h2 className="text-2xl font-semibold">No tasks yet</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-300">
              Create the first task to start a real ledger.
            </p>
            <Link
              href="/tasks/new"
              className="mt-6 inline-flex rounded-full border border-cyan-300 px-5 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950"
            >
              Create Task
            </Link>
          </section>
        ) : (
          <section className="grid gap-4">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="group rounded-3xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-0.5 hover:border-cyan-300/70 hover:bg-slate-900/80"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold group-hover:text-cyan-200">
                      {task.title}
                    </h2>
                    <p className="mt-2 text-slate-300">{task.objective}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide">
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">
                      {task.domain}
                    </span>
                    <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-cyan-200">
                      {task.status}
                    </span>
                  </div>
                </div>
                <p className="mt-5 text-sm text-slate-500">
                  Created {formatDate(task.created_at)}
                </p>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
