"use client";

import { useState, useCallback, useRef } from "react";
import { Exploration, Lens, Concept, Connection, AgentStage } from "@/lib/types";

type StreamStatus = "idle" | "streaming" | "complete" | "error";

const LENS_STAGGER = 300;
const CONCEPT_STAGGER = 200;
const CONNECTION_STAGGER = 150;
const STREAM_TIMEOUT_MS = 300_000; // 5 minutes max for entire exploration

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
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, STREAM_TIMEOUT_MS);

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
        if (timedOut) {
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

// Track drip offsets so parallel batches appear in lens order
let conceptsPerLens = 5; // estimated, used for offset calculation
let connectionDripOffset = 0;

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
    case "status": {
      setStage((data as { stage: AgentStage }).stage);
      const stage = (data as { stage: string }).stage;
      if (stage === "connect") connectionDripOffset = 0;
      break;
    }
    case "lenses": {
      const lenses = data as Lens[];
      lenses.forEach((lens, i) => {
        const t = setTimeout(() => {
          setExploration((prev) => {
            if (!prev) return prev;
            const exists = prev.lenses.some((l) => l.id === lens.id);
            if (exists) return prev;
            return { ...prev, lenses: [...prev.lenses, { ...lens, concepts: [] }] };
          });
        }, i * LENS_STAGGER);
        timers.push(t);
      });
      break;
    }
    case "concepts": {
      const { lensId, concepts } = data as {
        lensId: string;
        concepts: Concept[];
      };
      // Drip concepts in sequentially by lens index
      const lensIndex = parseInt(lensId.split("-")[1], 10) || 0;
      const batchStart = lensIndex * conceptsPerLens;
      concepts.forEach((concept, i) => {
        const delay = (batchStart + i) * CONCEPT_STAGGER;
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
        }, delay);
        timers.push(t);
      });
      break;
    }
    case "connections": {
      const connections = data as Connection[];
      const batchStart = connectionDripOffset;
      connections.forEach((conn, i) => {
        const delay = (batchStart + i) * CONNECTION_STAGGER;
        const t = setTimeout(() => {
          setExploration((prev) =>
            prev ? { ...prev, connections: [...prev.connections, conn] } : prev
          );
        }, delay);
        timers.push(t);
      });
      connectionDripOffset = batchStart + connections.length;
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
