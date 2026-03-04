"use client";

import { Concept, Connection } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function NodeDetail({
  concept,
  connections,
  allConcepts,
  onClose,
}: {
  concept: Concept;
  connections: Connection[];
  allConcepts: Concept[];
  onClose: () => void;
}) {
  function getConceptName(id: string) {
    return allConcepts.find((c) => c.id === id)?.name ?? id;
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 bg-card border border-border/50 rounded-xl shadow-2xl backdrop-blur-sm p-4 max-w-md z-10 animate-fade-in-up">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-sm">{concept.name}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 text-muted-foreground"
        >
          &times;
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {concept.description}
      </p>
      {concept.thinkers.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {concept.thinkers.map((t) => (
            <Badge key={t} variant="outline" className="text-xs">
              {t}
            </Badge>
          ))}
        </div>
      )}
      {connections.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-muted-foreground">
            Connections
          </div>
          {connections.map((conn) => {
            const otherId =
              conn.sourceConceptId === concept.id
                ? conn.targetConceptId
                : conn.sourceConceptId;
            return (
              <div key={conn.id} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {getConceptName(otherId)}
                </span>{" "}
                — {conn.description.slice(0, 150)}
                {conn.description.length > 150 ? "..." : ""}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
