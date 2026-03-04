"use client";

export function SynthesisCard({ content }: { content: string }) {
  const paragraphs = content.split("\n\n").filter(Boolean);

  return (
    <div className="relative rounded-2xl p-px bg-gradient-to-br from-primary/50 via-purple-500/30 to-emerald-500/20">
      <div className="rounded-[15px] bg-card px-6 py-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Synthesis
          </h3>
        </div>
        <div className="space-y-4">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="text-sm text-foreground/80 leading-relaxed animate-fade-in-up"
              style={{ animationDelay: `${i * 150}ms`, animationFillMode: "both" }}
            >
              {p}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
