import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { Exploration, ExplorationMeta } from "@/lib/types";

export async function GET() {
  const dir = path.join(process.cwd(), "public", "explorations");

  try {
    const files = await fs.readdir(dir);
    const metas: ExplorationMeta[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(dir, file), "utf-8");
      const exploration: Exploration = JSON.parse(raw);
      metas.push({
        id: exploration.id,
        question: exploration.question,
        lensCount: exploration.lenses.length,
        conceptCount: exploration.lenses.reduce(
          (sum, l) => sum + l.concepts.length,
          0
        ),
      });
    }

    return NextResponse.json(metas);
  } catch {
    return NextResponse.json([]);
  }
}
