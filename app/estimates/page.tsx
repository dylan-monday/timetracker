"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { fetchEstimatesList, createEstimate } from "@/lib/supabase/estimates";
import type { EstimateListItem, EstimateStatus } from "@/lib/types";
import { getContextualGreeting, extractFirstName } from "@/lib/greeting";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusBadgeClasses(status: EstimateStatus): string {
  switch (status) {
    case "draft":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "live":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "archived":
      return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

function getStatusLabel(status: EstimateStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "live":
      return "Live";
    case "archived":
      return "Archived";
  }
}

export default function EstimatesPage() {
  const router = useRouter();
  const { supabase, user } = useAuth();

  const [estimates, setEstimates] = useState<EstimateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const greeting = getContextualGreeting(extractFirstName(user));

  const refresh = useCallback(async () => {
    if (!supabase) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchEstimatesList(supabase);
      setEstimates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load estimates");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreateEstimate = async () => {
    if (!supabase || !user) return;

    setCreating(true);
    setError(null);

    try {
      const estimateId = await createEstimate(
        supabase,
        user.id,
        "", // Empty name - user fills in
        null // clientId - selected later
        // No default phases - start blank
      );
      router.push(`/estimates/${estimateId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create estimate");
      setCreating(false);
    }
  };

  const draftEstimates = estimates.filter((e) => e.status === "draft");
  const liveEstimates = estimates.filter((e) => e.status === "live");
  const archivedEstimates = estimates.filter((e) => e.status === "archived");

  return (
    <AppShell title="Estimates" subtitle={greeting}>
      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Build project fee proposals and track against estimates.
        </p>
        <button
          onClick={handleCreateEstimate}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-ink/90 hover:shadow active:scale-[0.98] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {creating ? "Creating..." : "New Estimate"}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-muted">Loading estimates...</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && estimates.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-black/10 bg-panel/50 py-16">
          <div className="rounded-full bg-black/5 p-4">
            <FileText className="h-8 w-8 text-muted" />
          </div>
          <div className="text-center">
            <h3 className="font-medium text-ink">No estimates yet</h3>
            <p className="mt-1 text-sm text-muted">
              Create your first project fee estimate.
            </p>
          </div>
          <button
            onClick={handleCreateEstimate}
            disabled={creating}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-ink/90 hover:shadow active:scale-[0.98] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? "Creating..." : "Create Estimate"}
          </button>
        </div>
      )}

      {/* Estimates list */}
      {!loading && estimates.length > 0 && (
        <div className="space-y-8">
          {/* Live estimates */}
          {liveEstimates.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
                Live ({liveEstimates.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {liveEstimates.map((estimate) => (
                  <EstimateCard
                    key={estimate.id}
                    estimate={estimate}
                    onClick={() => router.push(`/estimates/${estimate.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Draft estimates */}
          {draftEstimates.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
                Drafts ({draftEstimates.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {draftEstimates.map((estimate) => (
                  <EstimateCard
                    key={estimate.id}
                    estimate={estimate}
                    onClick={() => router.push(`/estimates/${estimate.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Archived estimates */}
          {archivedEstimates.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
                Archived ({archivedEstimates.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 opacity-60">
                {archivedEstimates.map((estimate) => (
                  <EstimateCard
                    key={estimate.id}
                    estimate={estimate}
                    onClick={() => router.push(`/estimates/${estimate.id}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

function EstimateCard({
  estimate,
  onClick,
}: {
  estimate: EstimateListItem;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-2xl border border-black/5 bg-panel p-4 text-left shadow-soft transition-all hover:border-black/10 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-ink">{estimate.name}</h3>
          {(estimate.clientName || estimate.projectName) && (
            <p className="mt-0.5 truncate text-sm text-muted">
              {estimate.clientName}
              {estimate.clientName && estimate.projectName && " · "}
              {estimate.projectName}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClasses(
            estimate.status
          )}`}
        >
          {getStatusLabel(estimate.status)}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3 text-muted">
          <span>{formatCents(estimate.totalCents)}</span>
          <span className="text-black/20">·</span>
          <span>
            {estimate.phaseCount} {estimate.phaseCount === 1 ? "phase" : "phases"}
          </span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <p className="text-xs text-muted/70">
        Updated {formatDate(estimate.updatedAt)}
      </p>
    </button>
  );
}
