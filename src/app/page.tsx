import { Hero } from "@/components/hero";
import { ExplorationCard } from "@/components/exploration-card";
import { ExplorationMeta } from "@/lib/types";

async function getExplorations(): Promise<ExplorationMeta[]> {
  const { promises: fs } = await import("fs");
  const path = await import("path");
  const dir = path.join(process.cwd(), "public", "explorations");

  try {
    const files = await fs.readdir(dir);
    const metas: ExplorationMeta[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(dir, file), "utf-8");
      const exploration = JSON.parse(raw);
      metas.push({
        id: exploration.id,
        question: exploration.question,
        lensCount: exploration.lenses.length,
        conceptCount: exploration.lenses.reduce(
          (sum: number, l: { concepts: unknown[] }) => sum + l.concepts.length,
          0
        ),
      });
    }

    return metas;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const explorations = await getExplorations();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <Hero />

        {/* Gradient divider */}
        <div className="flex justify-center">
          <div className="w-[min(400px,60%)] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>

        <section className="max-w-4xl mx-auto px-4 pt-12 pb-20">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Example Explorations
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {explorations.map((meta) => (
              <ExplorationCard key={meta.id} meta={meta} />
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-6 text-center text-sm text-muted-foreground">
        <p>
          Built by Dan &middot;{" "}
          <a
            href="https://github.com"
            className="underline hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
