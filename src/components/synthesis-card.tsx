"use client";

import ReactMarkdown from "react-markdown";

export function SynthesisCard({ content }: { content: string }) {
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
        <div className="max-w-none text-foreground/80 leading-relaxed text-sm [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:mb-3 [&_h1]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-2 [&_h2]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mb-2 [&_h3]:mt-3 [&_strong]:text-foreground [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:mb-4 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:mb-1">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
