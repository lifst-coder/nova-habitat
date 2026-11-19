import { createFileRoute } from "@tanstack/react-router";
import Studio from "@/components/habitat/Studio";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="h-dvh bg-bg text-fg">
      <Studio />
    </main>
  );
}
