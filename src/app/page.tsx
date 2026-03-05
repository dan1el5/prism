import { Hero } from "@/components/hero";
import { ExplorationMeta } from "@/lib/types";
import Link from "next/link";

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
    <div className="relative min-h-screen flex flex-col">
      {/* Dot grid background spanning full page */}
      <div
        className="absolute inset-0 pointer-events-none sm:dot-grid-bg"
        style={{
          backgroundImage: "radial-gradient(circle, oklch(1 0 0 / 8%) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <main className="flex-1 flex flex-col justify-center">
        <Hero />

        {explorations.length > 0 && (
          <section className="relative z-10 max-w-3xl mx-auto px-4 mt-2 sm:-mt-4 pb-4">
            <div className="flex flex-wrap justify-center gap-3">
              {explorations.map((meta) => (
                <Link
                  key={meta.id}
                  href={`/explore/${meta.id}`}
                  className="text-sm text-center text-foreground/70 hover:text-foreground border border-border hover:border-indigo-500/50 bg-card/60 hover:bg-card rounded-full px-5 py-2.5 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5"
                >
                  {meta.question}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
