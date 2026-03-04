"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Exploration, AgentStage } from "@/lib/types";

const LENS_DELAY = 300;
const CONCEPT_DELAY = 200;
const CONNECTION_DELAY = 250;
const STAGE_GAP = 400;

export function useProgressiveReveal(source: Exploration | null) {
  const [exploration, setExploration] = useState<Exploration | null>(null);
  const [currentStage, setCurrentStage] = useState<AgentStage>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const skip = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (source) {
      setExploration({ ...source });
      setCurrentStage(null);
      setIsComplete(true);
      setIsRevealing(false);
    }
  }, [source]);

  useEffect(() => {
    if (!source) return;

    // Reset
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setIsRevealing(true);
    setIsComplete(false);

    const empty: Exploration = {
      ...source,
      lenses: [],
      connections: [],
      synthesis: null,
      status: "running",
    };
    setExploration(empty);

    let delay = 200;
    const schedule = (fn: () => void, ms: number) => {
      delay += ms;
      const t = setTimeout(fn, delay);
      timeoutsRef.current.push(t);
    };

    // Stage 1: Decompose — reveal lenses one by one
    schedule(() => setCurrentStage("decompose"), 0);

    source.lenses.forEach((lens, i) => {
      schedule(() => {
        setExploration((prev) => {
          if (!prev) return prev;
          const newLenses = [...prev.lenses, { ...lens, concepts: [] }];
          return { ...prev, lenses: newLenses };
        });
      }, i === 0 ? STAGE_GAP : LENS_DELAY);
    });

    // Stage 2: Explore — reveal concepts per lens
    schedule(() => setCurrentStage("explore"), STAGE_GAP);

    source.lenses.forEach((lens) => {
      lens.concepts.forEach((concept, ci) => {
        schedule(() => {
          setExploration((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              lenses: prev.lenses.map((l) =>
                l.id === lens.id
                  ? { ...l, concepts: [...l.concepts, concept] }
                  : l
              ),
            };
          });
        }, ci === 0 ? LENS_DELAY : CONCEPT_DELAY);
      });
    });

    // Stage 3: Connect — reveal connections one by one
    schedule(() => setCurrentStage("connect"), STAGE_GAP);

    source.connections.forEach((conn, i) => {
      schedule(() => {
        setExploration((prev) => {
          if (!prev) return prev;
          return { ...prev, connections: [...prev.connections, conn] };
        });
      }, i === 0 ? STAGE_GAP : CONNECTION_DELAY);
    });

    // Stage 4: Synthesize
    schedule(() => setCurrentStage("synthesize"), STAGE_GAP);

    schedule(() => {
      setExploration((prev) =>
        prev ? { ...prev, synthesis: source.synthesis, status: "complete" } : prev
      );
    }, STAGE_GAP);

    // Done
    schedule(() => {
      setCurrentStage(null);
      setIsComplete(true);
      setIsRevealing(false);
    }, STAGE_GAP);

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [source]);

  return { exploration, currentStage, isComplete, isRevealing, skip };
}
