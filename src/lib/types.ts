export type Exploration = {
  id: string;
  question: string;
  status: "running" | "complete";
  lenses: Lens[];
  connections: Connection[];
  synthesis: string | null;
};

export type Lens = {
  id: string;
  name: string;
  description: string;
  concepts: Concept[];
};

export type Concept = {
  id: string;
  lensId: string;
  name: string;
  description: string;
  thinkers: string[];
};

export type Connection = {
  id: string;
  sourceConceptId: string;
  targetConceptId: string;
  description: string;
};

export type ExplorationMeta = {
  id: string;
  question: string;
  lensCount: number;
  conceptCount: number;
};

export type AgentStage = "decompose" | "explore" | "connect" | "synthesize" | null;

export type SSEEvent =
  | { type: "status"; data: { stage: "decompose" | "explore" | "connect" | "synthesize" } }
  | { type: "lenses"; data: Lens[] }
  | { type: "concepts"; data: { lensId: string; concepts: Concept[] } }
  | { type: "connections"; data: Connection[] }
  | { type: "synthesis"; data: { content: string } }
  | { type: "done"; data: Record<string, never> }
  | { type: "error"; data: { message: string } };
