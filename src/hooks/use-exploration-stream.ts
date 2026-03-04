"use client";

import { useState, useCallback, useRef } from "react";
import { Exploration, Lens, Concept, Connection, AgentStage } from "@/lib/types";

type StreamStatus = "idle" | "streaming" | "complete" | "error";

export function useExplorationStream() {
  const [exploration, setExploration] = useState<Exploration | null>(null);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [stage, setStage] = useState<AgentStage>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (question: string) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

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
        const data = await res.json();
        throw new Error(data.error || "Request failed");
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
            const data = JSON.parse(line.slice(6));
            handleEvent(eventType, data, setExploration, setStage, setStatus, setError);
            eventType = "";
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message);
      setStatus("error");
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  return { exploration, status, stage, error, start, stop };
}

function handleEvent(
  type: string,
  data: unknown,
  setExploration: React.Dispatch<React.SetStateAction<Exploration | null>>,
  setStage: React.Dispatch<React.SetStateAction<AgentStage>>,
  setStatus: React.Dispatch<React.SetStateAction<StreamStatus>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>
) {
  switch (type) {
    case "status":
      setStage((data as { stage: AgentStage }).stage);
      break;
    case "lenses":
      setExploration((prev) =>
        prev ? { ...prev, lenses: data as Lens[] } : prev
      );
      break;
    case "concepts": {
      const { lensId, concepts } = data as {
        lensId: string;
        concepts: Concept[];
      };
      setExploration((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lenses: prev.lenses.map((l) =>
            l.id === lensId ? { ...l, concepts } : l
          ),
        };
      });
      break;
    }
    case "connections":
      setExploration((prev) =>
        prev ? { ...prev, connections: data as Connection[] } : prev
      );
      break;
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
