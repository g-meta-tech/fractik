import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Proyectos</h1>

      {/* Empty state */}
      <Card className="mt-6">
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
    </div>
  );
}
