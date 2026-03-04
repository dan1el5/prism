"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Exploration } from "@/lib/types";
import { useExplorationStream } from "@/hooks/use-exploration-stream";
import { useProgressiveReveal } from "@/hooks/use-progressive-reveal";
import { AgentTrace } from "@/components/agent-trace";
import { KnowledgeGraph } from "@/components/knowledge-graph";
import { SynthesisCard } from "@/components/synthesis-card";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";
import Link from "next/link";

function ExplorationContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const isLive = id === "live";
  const question = searchParams.get("q") ?? "";

  const [prebaked, setPrebaked] = useState<Exploration | null>(null);
  const [loading, setLoading] = useState(!isLive);
  const stream = useExplorationStream();
  const reveal = useProgressiveReveal(prebaked);

  const [synthOpen, setSynthOpen] = useState(false);

  // Fetch pre-baked exploration
  useEffect(() => {
    if (isLive) return;
    setLoading(true);
    fetch(`/api/explorations/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setPrebaked(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, isLive]);

  // Start live exploration
  useEffect(() => {
    if (isLive && question) {
      stream.start(question);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, question]);

  const exploration = isLive ? stream.exploration : reveal.exploration;
  const isComplete = isLive ? stream.status === "complete" : reveal.isComplete;
  const currentStage = isLive ? stream.stage : reveal.currentStage;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading exploration...
      </div>
    );
  }

  if (!exploration) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>Exploration not found.</p>
        <Link href="/" className="underline hover:text-foreground">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-border/50 px-4 py-3 flex items-center gap-4 bg-card/50 backdrop-blur-sm">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back
        </Link>
        <h1 className="text-sm font-medium truncate flex-1">
          {exploration.question}
        </h1>
        {!isLive && reveal.isRevealing && (
          <Button
            variant="outline"
            size="sm"
            onClick={reveal.skip}
            className="text-xs border-border/50"
          >
            Skip animation
          </Button>
        )}
      </header>

      {/* Main layout */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left panel — Agent Trace (scrollable) */}
        <div className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-border/50 p-4 overflow-y-auto max-h-[300px] lg:max-h-none">
          <AgentTrace
            exploration={exploration}
            currentStage={currentStage}
            isComplete={isComplete}
          />
        </div>

        {/* Right panel — Knowledge Graph */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="flex-1 min-h-0">
            <KnowledgeGraph exploration={exploration} />
          </div>

          {/* Synthesis button */}
          {exploration.synthesis && !synthOpen && (
            <div className="absolute bottom-6 right-6 animate-fade-in-up">
              <button
                onClick={() => setSynthOpen(true)}
                className="group flex items-center gap-3 px-7 py-3.5 rounded-full border border-border/50 bg-card/90 backdrop-blur-sm shadow-lg hover:shadow-xl hover:border-primary/40 transition-all duration-300"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-base font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                  Read Synthesis
                </span>
              </button>
            </div>
          )}

          {/* Synthesis modal — scoped to graph panel */}
          {synthOpen && exploration.synthesis && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-8">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setSynthOpen(false)}
              />
              <div className="relative w-full max-w-3xl max-h-full overflow-y-auto rounded-xl border border-border/50 bg-card p-6 shadow-2xl animate-fade-in-up">
                <button
                  onClick={() => setSynthOpen(false)}
                  className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                >
                  <XIcon className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
                <SynthesisCard content={exploration.synthesis} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {stream.error && (
        <div className="max-w-4xl mx-auto w-full px-4 pb-8">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
            {stream.error}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          Loading...
        </div>
      }
    >
      <ExplorationContent />
    </Suspense>
  );
}
