"use client";

import { useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { demoWeekLines, makeWeekDays } from "@/lib/mock-data";
import { minutesToDisplay, parseAndRoundTimeInput } from "@/lib/time";
import { missingMinutes, missingState, targetWorkingMinutes } from "@/lib/missing-time";
import type { WeekLine } from "@/lib/types";

const BUSINESS_DAY_INDEXES = [1, 2, 3, 4, 5];
const ALL_DAY_INDEXES = [1, 2, 3, 4, 5, 6, 7];

function stateClass(state: "ok" | "attention" | "gap"): string {
  if (state === "ok") return "bg-accent/40 text-ink";
  if (state === "attention") return "bg-warning/40 text-ink";
  return "bg-danger/35 text-ink";
}

export function WeekGrid() {
  const weekDays = useMemo(() => makeWeekDays(), []);
  const [showWeekends, setShowWeekends] = useState(false);
  const [lines, setLines] = useState<WeekLine[]>(demoWeekLines);
  const [entryInput, setEntryInput] = useState("");
  const [activeCell, setActiveCell] = useState<{ lineId: string; dayIndex: number } | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const visibleDayIndexes = showWeekends ? ALL_DAY_INDEXES : BUSINESS_DAY_INDEXES;

  const totalsByDay = visibleDayIndexes.reduce<Record<number, number>>((acc, dayIndex) => {
    acc[dayIndex] = lines.reduce((sum, line) => sum + (line.cells[String(dayIndex)] ?? 0), 0);
    return acc;
  }, {});

  const handleCellSubmit = () => {
    if (!activeCell) return;
    const rounded = parseAndRoundTimeInput(entryInput);
    if (rounded === null) return;

    setLines((current) =>
      current.map((line) => {
        if (line.id !== activeCell.lineId) return line;
        return {
          ...line,
          cells: {
            ...line.cells,
            [String(activeCell.dayIndex)]: rounded
          }
        };
      })
    );

    setEntryInput("");
    setActiveCell(null);
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">Fast, human entry. Type `1.5`, `1h 30m`, or `90m`.</p>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium"
            onClick={() => setShowWeekends((value) => !value)}
          >
            {showWeekends ? "Hide weekends" : "Show weekends"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Line</th>
                {visibleDayIndexes.map((dayIndex) => {
                  const day = weekDays[dayIndex - 1];
                  const minutes = totalsByDay[dayIndex] ?? 0;
                  const status = missingState(minutes);

                  return (
                    <th key={day.isoDate} className="px-3 py-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span>
                          {day.label} {day.day}
                        </span>
                        <span className="text-[11px] font-medium text-muted">{minutesToDisplay(minutes)}</span>
                      </div>
                      <div className={`rounded-full px-2 py-1 text-[11px] font-medium ${stateClass(status)}`}>
                        {status === "ok"
                          ? "On track"
                          : `${Math.round(missingMinutes(minutes) / 60)}h open (8-5)`}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="rounded-xl bg-white/90 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                  <td className="rounded-l-xl px-3 py-3 align-middle">
                    <p className="text-sm font-medium text-ink">{line.projectName}</p>
                    <p className="text-xs text-muted">
                      {line.clientName}
                      {line.isDraft ? " • draft approval" : ""}
                    </p>
                  </td>
                  {visibleDayIndexes.map((dayIndex) => {
                    const isActive =
                      activeCell?.lineId === line.id && activeCell?.dayIndex === dayIndex;
                    const value = line.cells[String(dayIndex)] ?? 0;

                    return (
                      <td key={`${line.id}-${dayIndex}`} className="px-3 py-2">
                        {isActive ? (
                          <input
                            autoFocus
                            value={entryInput}
                            onChange={(event) => setEntryInput(event.target.value)}
                            onBlur={handleCellSubmit}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                handleCellSubmit();
                              }
                            }}
                            className="w-full rounded-lg border border-black/15 bg-canvas px-2 py-1.5 text-sm focus:border-black/30 focus:outline-none"
                            placeholder="1h 30m"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCell({ lineId: line.id, dayIndex });
                              setEntryInput(value ? String(value / 60) : "");
                            }}
                            className="w-full rounded-lg border border-transparent px-2 py-1.5 text-left text-sm transition hover:border-black/10 hover:bg-canvas"
                          >
                            {minutesToDisplay(value)}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"
            onClick={() => setShowQuickAdd(true)}
          >
            <Plus className="h-4 w-4" />
            Add line
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"
          >
            <Sparkles className="h-4 w-4" />
            Copy last week
          </button>
        </div>
      </div>

      {showQuickAdd ? (
        <aside className="fixed inset-x-0 bottom-0 z-20 rounded-t-3xl border border-black/10 bg-panel p-4 shadow-[0_-20px_50px_rgba(0,0,0,0.14)] sm:mx-auto sm:mb-6 sm:max-w-xl">
          <h2 className="text-base font-semibold">Quick add line</h2>
          <p className="mt-1 text-sm text-muted">Thumb-first flow: client then project, add missing right there.</p>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Client</span>
              <input
                type="text"
                placeholder="Pick existing or create new"
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Project</span>
              <input
                type="text"
                placeholder="Pick existing or create new"
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Tags (optional)</span>
              <input
                type="text"
                placeholder="strategy, social, production"
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
              />
            </label>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"
              onClick={() => setShowQuickAdd(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="flex-1 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
              onClick={() => setShowQuickAdd(false)}
            >
              Save line
            </button>
          </div>
        </aside>
      ) : null}

      <div className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <h2 className="text-base font-semibold">Calendar drafts</h2>
        <p className="mt-1 text-sm text-muted">
          Meeting imports create immediate drafts in this week. Approve, reassign, or reject in-line.
        </p>
        <div className="mt-3 rounded-xl border border-dashed border-black/15 p-3 text-sm text-muted">
          2 draft entries awaiting approval. Auto-suggestion used title, attendees, and calendar.
        </div>
      </div>

      <div className="text-xs text-muted">
        Daily target: {minutesToDisplay(targetWorkingMinutes())} between 8:00 and 17:00.
      </div>
    </section>
  );
}
