"use client";

import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SynthesisCard({ content }: { content: string }) {
  const paragraphs = content.split("\n\n").filter(Boolean);

  return (
    <div className="relative mt-6 rounded-xl p-px bg-gradient-to-br from-primary/40 via-purple-500/30 to-emerald-500/20">
      <div className="rounded-[11px] bg-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            Synthesis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="text-sm text-muted-foreground leading-relaxed animate-fade-in-up"
              style={{ animationDelay: `${i * 150}ms`, animationFillMode: "both" }}
            >
              {p}
            </p>
          ))}
        </CardContent>
      </div>
    </div>
  );
}
