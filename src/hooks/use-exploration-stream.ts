"use client";

import { useState, useCallback, useRef } from "react";
import { Exploration, Lens, Concept, Connection, AgentStage } from "@/lib/types";

type StreamStatus = "idle" | "streaming" | "complete" | "error";

const CONCEPT_STAGGER = 150;
const CONNECTION_STAGGER = 120;
const STREAM_TIMEOUT_MS = 120_000; // 2 minutes max for entire exploration

export function useExplorationStream() {
  const [exploration, setExploration] = useState<Exploration | null>(null);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [stage, setStage] = useState<AgentStage>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const start = useCallback(async (question: string) => {
    abortRef.current?.abort();
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const abort = new AbortController();
    abortRef.current = abort;

    // Overall stream timeout
    const timeoutId = setTimeout(() => abort.abort(), STREAM_TIMEOUT_MS);

    setStatus("streaming");
    setStage(null);
    setError(null);

    const newExploration: Exploration = {
      id: "live",
      question,
      status: "running",
      lenses: [],
      connections: [],
      synthesis: null,
    };
    setExploration(newExploration);

    try {
      const res = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: abort.signal,
      });

      if (!res.ok) {
        let message = "Request failed";
        try {
          const data = await res.json();
          message = data.error || message;
        } catch {
          // Response wasn't JSON
          if (res.status === 503) message = "Service unavailable. Please try again later.";
          else if (res.status >= 500) message = "Server error. Please try again.";
        }
        throw new Error(message);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              handleEvent(eventType, data, setExploration, setStage, setStatus, setError, timersRef.current);
            } catch {
              console.warn("[prism] Failed to parse SSE data:", line.slice(6));
            }
            eventType = "";
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // Check if this was a timeout vs user-initiated abort
        if (!abort.signal.aborted) return;
        // If we timed out, show an error
        const isTimeout = timersRef.current.length === 0;
        if (isTimeout) {
          setError("Exploration timed out. Please try again.");
          setStatus("error");
        }
        return;
      }
      setError((err as Error).message);
      setStatus("error");
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setStatus("idle");
  }, []);

  const retry = useCallback(() => {
    if (exploration?.question) {
      start(exploration.question);
    }
  }, [exploration?.question, start]);

  return { exploration, status, stage, error, start, stop, retry };
}

function handleEvent(
  type: string,
  data: unknown,
  setExploration: React.Dispatch<React.SetStateAction<Exploration | null>>,
  setStage: React.Dispatch<React.SetStateAction<AgentStage>>,
  setStatus: React.Dispatch<React.SetStateAction<StreamStatus>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  timers: ReturnType<typeof setTimeout>[]
) {
  switch (type) {
    case "status":
      setStage((data as { stage: AgentStage }).stage);
      break;
    case "lenses":
      setExploration((prev) =>
        prev ? { ...prev, lenses: (data as Lens[]).map(l => ({ ...l, concepts: [] })) } : prev
      );
      break;
    case "concepts": {
      const { lensId, concepts } = data as {
        lensId: string;
        concepts: Concept[];
      };
      // Drip concepts in one by one
      concepts.forEach((concept, i) => {
        const t = setTimeout(() => {
          setExploration((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              lenses: prev.lenses.map((l) =>
                l.id === lensId
                  ? { ...l, concepts: [...l.concepts, concept] }
                  : l
              ),
            };
          });
        }, i * CONCEPT_STAGGER);
        timers.push(t);
      });
      break;
    }
    case "connections": {
      const connections = data as Connection[];
      // Drip connections in one by one
      connections.forEach((conn, i) => {
        const t = setTimeout(() => {
          setExploration((prev) =>
            prev ? { ...prev, connections: [...prev.connections, conn] } : prev
          );
        }, i * CONNECTION_STAGGER);
        timers.push(t);
      });
      break;
    }
    case "synthesis":
      setExploration((prev) =>
        prev
          ? { ...prev, synthesis: (data as { content: string }).content }
          : prev
      );
      break;
    case "done":
      setExploration((prev) =>
        prev ? { ...prev, status: "complete" } : prev
      );
      setStatus("complete");
      break;
    case "error":
      setError((data as { message: string }).message);
      setStatus("error");
      break;
  }
}
