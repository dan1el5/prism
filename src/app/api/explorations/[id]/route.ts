import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dir = path.join(process.cwd(), "public", "explorations");

  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(dir, file), "utf-8");
      const exploration = JSON.parse(raw);
      if (exploration.id === id) {
        return NextResponse.json(exploration);
      }
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
