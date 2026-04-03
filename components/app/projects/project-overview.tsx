"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import { Layers, GitBranch, FileText, TestTube2 } from "lucide-react";

interface ProjectOverviewProps {
  projectId: Id<"projects">;
  visionContent: string;
}

export function ProjectOverview({ projectId, visionContent }: ProjectOverviewProps) {
  const capabilities = useQuery(api.capabilities.listByProject, { projectId });

  const stats = capabilities !== undefined
    ? { capabilityCount: capabilities.length }
    : null;

  return (
    <div className="space-y-6">
      {/* Vision */}
      {visionContent && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Vision Statement
          </h3>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="whitespace-pre-wrap text-sm">{visionContent}</p>
          </div>
        </section>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Layers}
          label="Capabilities"
          value={stats?.capabilityCount}
        />
        <StatCard
          icon={GitBranch}
          label="Features"
          value={undefined}
          loading={capabilities === undefined}
        />
        <StatCard
          icon={FileText}
          label="Specs"
          value={undefined}
          loading={capabilities === undefined}
        />
        <StatCard
          icon={TestTube2}
          label="Tests"
          value={undefined}
          loading={capabilities === undefined}
        />
      </div>

      {/* Capabilities preview */}
      {capabilities !== undefined && capabilities.length === 0 && (
        <EmptyState
          icon={Layers}
          title="Sin capabilities"
          description="Agrega tu primera capability para empezar a estructurar el producto."
        />
      )}

      {capabilities !== undefined && capabilities.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Capabilities ({capabilities.length})
          </h3>
          <div className="space-y-2">
            {capabilities.map((cap) => (
              <div
                key={cap._id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="text-sm font-medium">{cap.name}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {cap.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading || value === undefined ? (
          <div className="h-7 w-12 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-2xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
