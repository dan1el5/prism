"use client";

import { Exploration, AgentStage } from "@/lib/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef } from "react";

const STAGES: { key: NonNullable<AgentStage>; label: string; icon: string }[] = [
  { key: "decompose", label: "Decompose", icon: "1" },
  { key: "explore", label: "Explore", icon: "2" },
  { key: "connect", label: "Connect", icon: "3" },
  { key: "synthesize", label: "Synthesize", icon: "4" },
];

const STAGE_ORDER = ["decompose", "explore", "connect", "synthesize"];

export function stageProgress(currentStage: AgentStage, isComplete: boolean): number {
  if (isComplete) return 100;
  if (!currentStage) return 0;
  const idx = STAGE_ORDER.indexOf(currentStage);
  return ((idx + 0.5) / STAGE_ORDER.length) * 100;
}

function stageStatus(
  stageKey: AgentStage,
  currentStage: AgentStage,
  isComplete: boolean
): "pending" | "active" | "complete" {
  if (isComplete) return "complete";
  const currentIdx = currentStage ? STAGE_ORDER.indexOf(currentStage) : -1;
  const stageIdx = stageKey ? STAGE_ORDER.indexOf(stageKey) : -1;
  if (stageIdx < currentIdx) return "complete";
  if (stageIdx === currentIdx) return "active";
  return "pending";
}

export function AgentTrace({
  exploration,
  currentStage,
  isComplete,
}: {
  exploration: Exploration;
  currentStage: AgentStage;
  isComplete: boolean;
}) {
  const [openStages, setOpenStages] = useState<Set<string>>(
    new Set(["decompose"])
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevConceptCountRef = useRef(0);
  const prevConnectionCountRef = useRef(0);

  // Open new stage when it becomes active
  useEffect(() => {
    if (isComplete) {
      setOpenStages(new Set(["synthesize"]));
      return;
    }
    if (currentStage) {
      setOpenStages((prev) => new Set([...prev, currentStage]));
    }
  }, [currentStage, isComplete]);

  // Close decompose when the first concept drips in
  const totalConcepts = exploration.lenses.reduce((sum, l) => sum + l.concepts.length, 0);
  useEffect(() => {
    if (prevConceptCountRef.current === 0 && totalConcepts > 0) {
      setOpenStages((prev) => {
        const next = new Set(prev);
        next.delete("decompose");
        return next;
      });
    }
    prevConceptCountRef.current = totalConcepts;
  }, [totalConcepts]);

  // Close explore when the first connection drips in
  const totalConnections = exploration.connections.length;
  useEffect(() => {
    if (prevConnectionCountRef.current === 0 && totalConnections > 0) {
      setOpenStages((prev) => {
        const next = new Set(prev);
        next.delete("explore");
        return next;
      });
    }
    prevConnectionCountRef.current = totalConnections;
  }, [totalConnections]);

  // Close connect when synthesis arrives
  useEffect(() => {
    if (exploration.synthesis) {
      setOpenStages((prev) => {
        const next = new Set(prev);
        next.delete("connect");
        return next;
      });
    }
  }, [exploration.synthesis]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [currentStage, exploration.lenses, exploration.connections, exploration.synthesis]);

  function toggle(key: string) {
    setOpenStages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const progress = stageProgress(currentStage, isComplete);

  return (
    <div className="space-y-4">
      <div className="hidden lg:block space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Agent Trace
        </h2>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, var(--primary), oklch(0.7 0.17 300))",
            }}
          />
        </div>
      </div>

      <div className="space-y-1">
        {STAGES.map(({ key, label, icon }, stageIdx) => {
          const status = stageStatus(key, currentStage, isComplete);
          return (
            <Collapsible
              key={key}
              open={openStages.has(key)}
              onOpenChange={() => toggle(key)}
            >
              <div className="relative flex">
                {/* Vertical connector line */}
                {stageIdx < STAGES.length - 1 && (
                  <div className="absolute left-4 top-10 bottom-0 w-px bg-border/50" />
                )}

                <CollapsibleTrigger className="flex items-center gap-3 w-full text-left py-2 text-sm">
                  <span
                    className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                      status === "complete"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : status === "active"
                          ? "bg-primary/20 text-primary animate-glow-pulse"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {status === "complete" ? "\u2713" : icon}
                  </span>
                  <span
                    className={
                      status === "pending"
                        ? "text-muted-foreground"
                        : "font-medium text-foreground"
                    }
                  >
                    {label}
                  </span>
                  {status === "active" && (
                    <Badge variant="outline" className="ml-auto text-xs border-primary/30 text-primary animate-pulse">
                      Running...
                    </Badge>
                  )}
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="hidden lg:block pl-11 text-sm text-muted-foreground space-y-2 pb-2">
                {key === "decompose" && exploration.lenses.length > 0 && (
                  <div className="space-y-1.5">
                    {exploration.lenses.map((lens, i) => (
                      <div
                        key={lens.id}
                        className="animate-fade-in-up"
                        style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
                      >
                        <span className="font-medium text-foreground">
                          {lens.name}
                        </span>{" "}
                        — {lens.description}
                      </div>
                    ))}
                  </div>
                )}
                {key === "explore" &&
                  exploration.lenses.some((l) => l.concepts.length > 0) && (
                    <div className="space-y-2">
                      {exploration.lenses
                        .filter((l) => l.concepts.length > 0)
                        .map((lens) => (
                          <div key={lens.id}>
                            <div className="font-medium text-foreground mb-1">
                              {lens.name}
                            </div>
                            {lens.concepts.map((c, ci) => (
                              <div
                                key={c.id}
                                className="ml-2 animate-fade-in-up"
                                style={{ animationDelay: `${ci * 80}ms`, animationFillMode: "both" }}
                              >
                                &bull; {c.name}
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  )}
                {key === "connect" && exploration.connections.length > 0 && (
                  <div className="space-y-1">
                    {exploration.connections.map((conn, ci) => (
                      <div
                        key={conn.id}
                        className="text-xs animate-fade-in-up"
                        style={{ animationDelay: `${ci * 60}ms`, animationFillMode: "both" }}
                      >
                        &bull; {conn.description}
                      </div>
                    ))}
                  </div>
                )}
                {key === "synthesize" && exploration.synthesis && (
                  <div className="text-xs italic animate-fade-in-up">Synthesis complete</div>
                )}
                {status === "pending" && (
                  <div className="text-xs italic text-muted-foreground/50">Waiting...</div>
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
