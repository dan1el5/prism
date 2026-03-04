import { NextRequest } from "next/server";
import { checkRateLimit, consumeRateLimit } from "@/lib/rate-limit";
import { decompose, explore, connect, synthesize } from "@/lib/agent/pipeline";
import { Lens } from "@/lib/types";

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const ip = getIP(req);
  const { allowed } = checkRateLimit(ip);

  if (!allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded. Browse the demo explorations instead.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const question = body.question?.trim();
  if (!question || question.length < 5 || question.length > 500) {
    return new Response(
      JSON.stringify({
        error: "Question must be between 5 and 500 characters",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  consumeRateLimit(ip);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      try {
        // Stage 1: Decompose
        send("status", { stage: "decompose" });
        const lenses = await decompose(question);
        send("lenses", lenses);

        // Stage 2: Explore (parallel)
        send("status", { stage: "explore" });
        const exploredLenses: Lens[] = await Promise.all(
          lenses.map(async (lens) => {
            const concepts = await explore(question, lens);
            const fullLens = { ...lens, concepts };
            send("concepts", { lensId: lens.id, concepts });
            return fullLens;
          })
        );

        // Stage 3: Connect
        send("status", { stage: "connect" });
        const connections = await connect(question, exploredLenses);
        send("connections", connections);

        // Stage 4: Synthesize
        send("status", { stage: "synthesize" });
        const synthesis = await synthesize(
          question,
          exploredLenses,
          connections
        );
        send("synthesis", { content: synthesis });

        send("done", {});
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
