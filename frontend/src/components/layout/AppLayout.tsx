import { Link, Outlet } from "react-router-dom";
import { Palette } from "lucide-react";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary to-background">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Palette className="h-5 w-5 text-primary" />
            <span>IconForge Workbench</span>
          </div>
          <nav className="text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              16x16 Pixel Studio
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
