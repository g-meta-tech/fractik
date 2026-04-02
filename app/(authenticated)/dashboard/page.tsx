"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";
import { ProjectCard } from "@/components/app/projects/project-card";
import { DashboardSkeleton } from "@/components/app/projects/dashboard-skeleton";

export default function DashboardPage() {
  const projects = useQuery(api.projects.listByOrg);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Proyectos</h1>

      <div className="mt-6">
        {projects === undefined ? (
          <DashboardSkeleton />
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-medium">No hay proyectos aún</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Crea tu primer proyecto para empezar a definir la estructura
                de tu producto.
              </p>
              <Button className="mt-6" disabled>
                Crear proyecto
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Disponible en Sprint Core
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p._id} project={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
