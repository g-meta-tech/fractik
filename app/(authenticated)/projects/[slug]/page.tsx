"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { InlineEdit } from "@/components/app/inline-edit";
import { ProjectOverview } from "@/components/app/projects/project-overview";
import { CapabilitiesTab } from "@/components/app/projects/capabilities-tab";
import { ProjectSettings } from "@/components/app/projects/project-settings";
import { toast } from "sonner";

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const project = useQuery(api.projects.getBySlug, { slug });
  const updateProject = useMutation(api.projects.update);

  if (project === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-muted" />
        <div className="mt-6 h-10 w-full animate-pulse rounded-md bg-muted" />
        <div className="mt-4 h-64 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-bold">Proyecto no encontrado</h1>
        <p className="mt-2 text-muted-foreground">
          El proyecto no existe o no pertenece a tu organización.
        </p>
      </div>
    );
  }

  async function handleNameSave(name: string) {
    try {
      await updateProject({ projectId: project!._id, name });
      toast.success("Nombre actualizado");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al actualizar",
      );
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3">
        <InlineEdit
          value={project.name}
          onSave={handleNameSave}
          as="h1"
          className="text-2xl font-bold tracking-tight"
        />
        <Badge variant={project.isPublic ? "default" : "secondary"}>
          {project.isPublic ? "Público" : "Privado"}
        </Badge>
      </div>

      {project.description && (
        <p className="mt-1 text-muted-foreground">{project.description}</p>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <ProjectOverview
            projectId={project._id}
            visionContent={project.visionContent}
          />
        </TabsContent>

        <TabsContent value="capabilities" className="mt-4">
          <CapabilitiesTab projectId={project._id} projectSlug={slug} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <ProjectSettings project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
