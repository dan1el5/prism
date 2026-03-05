import { NextRequest } from "next/server";
import { checkRateLimit, consumeRateLimit } from "@/lib/rate-limit";
import { decompose, explore, connect, synthesize, PipelineError } from "@/lib/agent/pipeline";
import { Lens } from "@/lib/types";

export const maxDuration = 120;

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

function userFacingMessage(error: unknown): string {
  if (error instanceof PipelineError) {
    switch (error.category) {
      case "config":
        return "The service is misconfigured. Please try again later.";
      case "rate_limit":
        return "The AI service is busy. Please try again in a minute.";
      case "timeout":
        return "The request took too long. Please try again.";
      case "api":
        return "Something went wrong with the AI service. Please try again.";
      case "parse":
        return "The AI returned an unexpected response. Please try again.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}

export async function POST(req: NextRequest) {
  // Fail fast if API key is missing
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[prism] ANTHROPIC_API_KEY is not set");
    return new Response(
      JSON.stringify({ error: "Service is not configured. Please try again later." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

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

      const pipelineStart = Date.now();

      try {
        // Stage 1: Decompose
        send("status", { stage: "decompose" });
        const lenses = await decompose(question);
        send("lenses", lenses);

        // Stage 2: Explore (parallel with partial failure tolerance)
        send("status", { stage: "explore" });
        const results = await Promise.allSettled(
          lenses.map(async (lens) => {
            const concepts = await explore(question, lens);
            const fullLens = { ...lens, concepts };
            send("concepts", { lensId: lens.id, concepts });
            return fullLens;
          })
        );

        const exploredLenses: Lens[] = [];
        let exploreFailures = 0;
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result.status === "fulfilled") {
            exploredLenses.push(result.value);
          } else {
            exploreFailures++;
            console.warn(`[prism] explore failed for lens "${lenses[i].name}":`, result.reason?.message);
            // Include the lens with no concepts so the graph still shows it
            exploredLenses.push({ ...lenses[i], concepts: [] });
          }
        }

        if (exploreFailures === lenses.length) {
          throw new PipelineError("All lenses failed to explore", "api", false, "explore");
        }

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

        const totalMs = Date.now() - pipelineStart;
        console.log(`[prism] exploration complete in ${totalMs}ms (${exploreFailures} lens failures)`);
        send("done", {});
      } catch (error) {
        const totalMs = Date.now() - pipelineStart;
        console.error(`[prism] exploration failed after ${totalMs}ms:`, error);
        send("error", { message: userFacingMessage(error) });
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
