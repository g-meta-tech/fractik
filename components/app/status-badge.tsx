"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  defined: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  spec_ready: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  in_progress: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  implemented: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  reviewed: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  approved: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  deprecated: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  passing: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  failing: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  skipped: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  blocked: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  defined: "Definido",
  spec_ready: "Spec listo",
  in_progress: "En progreso",
  done: "Hecho",
  implemented: "Implementado",
  reviewed: "Revisado",
  approved: "Aprobado",
  deprecated: "Deprecado",
  passing: "Pasando",
  failing: "Fallando",
  skipped: "Omitido",
  blocked: "Bloqueado",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs font-medium border-0",
        statusColors[status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
        className,
      )}
    >
      {statusLabels[status] ?? status}
    </Badge>
  );
}

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const priorityLabels: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs font-medium border-0",
        priorityColors[priority] ?? "bg-gray-100 text-gray-700",
        className,
      )}
    >
      {priorityLabels[priority] ?? priority}
    </Badge>
  );
}
