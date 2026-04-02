import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Fractik</h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Meta-development platform for AI-assisted software engineering
        </p>
      </div>
      <Button render={<Link href="/sign-in" />} nativeButton={false} size="lg">
        Iniciar
      </Button>
    </div>
  );
}
