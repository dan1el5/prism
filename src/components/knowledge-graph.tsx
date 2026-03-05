"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  NodeProps,
  Handle,
  Position,
  ConnectionLineType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Exploration, Concept } from "@/lib/types";
import { NodeDetail } from "./node-detail";

const LENS_COLORS: { bg: string; border: string; text: string }[] = [
  { bg: "rgba(99, 102, 241, 0.15)", border: "#818cf8", text: "#c7d2fe" },
  { bg: "rgba(245, 158, 11, 0.15)", border: "#fbbf24", text: "#fde68a" },
  { bg: "rgba(16, 185, 129, 0.15)", border: "#34d399", text: "#a7f3d0" },
  { bg: "rgba(239, 68, 68, 0.15)", border: "#f87171", text: "#fecaca" },
  { bg: "rgba(139, 92, 246, 0.15)", border: "#a78bfa", text: "#ddd6fe" },
];

function AllHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} id="t" className="opacity-0" />
      <Handle type="target" position={Position.Bottom} id="b-t" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="l-t" className="opacity-0" />
      <Handle type="target" position={Position.Right} id="r-t" className="opacity-0" />
      <Handle type="source" position={Position.Top} id="t-s" className="opacity-0" />
      <Handle type="source" position={Position.Bottom} id="b" className="opacity-0" />
      <Handle type="source" position={Position.Left} id="l" className="opacity-0" />
      <Handle type="source" position={Position.Right} id="r" className="opacity-0" />
    </>
  );
}

function QuestionNode({ data }: NodeProps<Node<{ label: string; animate: boolean }>>) {
  return (
    <div
      className={`px-6 py-3 rounded-2xl border border-primary/30 bg-primary/10 text-sm font-medium text-foreground text-center max-w-[300px] ${data.animate ? "animate-node-enter" : ""}`}
    >
      <AllHandles />
      <span>{data.label}</span>
    </div>
  );
}

function LensNode({ data }: NodeProps<Node<{ label: string; color: typeof LENS_COLORS[number]; animate: boolean }>>) {
  return (
    <div
      className={`px-5 py-2.5 rounded-lg border text-xs font-semibold uppercase tracking-wider text-center ${data.animate ? "animate-node-enter" : ""}`}
      style={{
        borderColor: data.color.border + "66",
        backgroundColor: data.color.bg,
        color: data.color.border,
      }}
    >
      <AllHandles />
      <span>{data.label}</span>
    </div>
  );
}

function ConceptNode({ data }: NodeProps<Node<{ label: string; color: typeof LENS_COLORS[number]; concept: Concept; animate: boolean }>>) {
  return (
    <div
      className={`px-4 py-3 rounded-xl border shadow-lg text-xs font-medium max-w-[180px] text-center cursor-pointer transition-shadow hover:shadow-xl ${data.animate ? "animate-node-enter" : ""}`}
      style={{
        borderColor: data.color.border,
        backgroundColor: data.color.bg,
        color: data.color.text,
        boxShadow: `0 0 12px ${data.color.border}33`,
      }}
    >
      <AllHandles />
      <span>{data.label}</span>
    </div>
  );
}

const nodeTypes = { question: QuestionNode, concept: ConceptNode, lens: LensNode };

// Radial layout: question at center, lenses around it, concepts around each lens
function radialLayout(
  lenses: Exploration["lenses"],
  questionNodeId: string
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const lensCount = lenses.length;

  // Question at origin
  positions.set(questionNodeId, { x: 0, y: 0 });

  const LENS_RADIUS = 500;
  const CONCEPT_RADIUS = 280;

  // Spread lenses evenly around the center, starting from top
  const startAngle = -Math.PI / 2;

  lenses.forEach((lens, i) => {
    const lensAngle = startAngle + (2 * Math.PI * i) / lensCount;
    const lensX = Math.cos(lensAngle) * LENS_RADIUS;
    const lensY = Math.sin(lensAngle) * LENS_RADIUS;
    positions.set(`lens-${lens.id}`, { x: lensX, y: lensY });

    const conceptCount = lens.concepts.length;
    if (conceptCount === 0) return;

    // Fan concepts in an arc radiating outward from the lens
    // Wider arc for more concepts
    const arcSpread = Math.min(Math.PI * 0.7, conceptCount * 0.4);

    lens.concepts.forEach((concept, ci) => {
      const offset =
        conceptCount === 1
          ? 0
          : -arcSpread / 2 + (arcSpread * ci) / (conceptCount - 1);
      const conceptAngle = lensAngle + offset;
      const cx = lensX + Math.cos(conceptAngle) * CONCEPT_RADIUS;
      const cy = lensY + Math.sin(conceptAngle) * CONCEPT_RADIUS;
      positions.set(concept.id, { x: cx, y: cy });
    });
  });

  // Resolve overlaps by pushing nodes apart
  const NODE_W = 280;
  const NODE_H = 90;
  const PADDING = 40;
  const ids = Array.from(positions.keys());

  for (let iter = 0; iter < 60; iter++) {
    let hadOverlap = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = positions.get(ids[i])!;
        const b = positions.get(ids[j])!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = (NODE_W + PADDING) - Math.abs(dx);
        const overlapY = (NODE_H + PADDING) - Math.abs(dy);
        if (overlapX > 0 && overlapY > 0) {
          hadOverlap = true;
          if (overlapX < overlapY) {
            const push = overlapX / 2 + 1;
            const dir = dx >= 0 ? 1 : -1;
            a.x -= dir * push;
            b.x += dir * push;
          } else {
            const push = overlapY / 2 + 1;
            const dir = dy >= 0 ? 1 : -1;
            a.y -= dir * push;
            b.y += dir * push;
          }
        }
      }
    }
    if (!hadOverlap) break;
  }

  return positions;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function KnowledgeGraphInner({
  exploration,
}: {
  exploration: Exploration;
}) {
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const animatedNodesRef = useRef<Set<string>>(new Set());
  const { fitView } = useReactFlow();
  const isMobile = useIsMobile();

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const rootId = "root-question";
    const shouldAnimateRoot = !animatedNodesRef.current.has(rootId);
    if (shouldAnimateRoot) animatedNodesRef.current.add(rootId);

    const questionLabel = exploration.question;

    nodes.push({
      id: rootId,
      type: "question",
      position: { x: 0, y: 0 },
      data: { label: questionLabel, animate: shouldAnimateRoot },
      selectable: false,
    });

    exploration.lenses.forEach((lens, lensIdx) => {
      const color = LENS_COLORS[lensIdx % LENS_COLORS.length];
      const lensNodeId = `lens-${lens.id}`;

      const shouldAnimateLens = !animatedNodesRef.current.has(lensNodeId);
      if (shouldAnimateLens) animatedNodesRef.current.add(lensNodeId);

      nodes.push({
        id: lensNodeId,
        type: "lens",
        position: { x: 0, y: 0 },
        data: { label: lens.name, color, animate: shouldAnimateLens },
        selectable: false,
      });

      edges.push({
        id: `root-${lensNodeId}`,
        source: rootId,
        target: lensNodeId,
        style: {
          stroke: color.border + "33",
          strokeWidth: 1.5,
        },
      });

      lens.concepts.forEach((concept) => {
        const shouldAnimate = !animatedNodesRef.current.has(concept.id);
        if (shouldAnimate) animatedNodesRef.current.add(concept.id);

        nodes.push({
          id: concept.id,
          type: "concept",
          position: { x: 0, y: 0 },
          data: { label: concept.name, color, concept, animate: shouldAnimate },
        });

        edges.push({
          id: `tree-${lensNodeId}-${concept.id}`,
          source: lensNodeId,
          target: concept.id,
          style: {
            stroke: color.border + "44",
            strokeWidth: 1.5,
          },
        });
      });
    });

    // Compute radial positions
    const positions = radialLayout(exploration.lenses, rootId);
    const laid = nodes.map((node) => {
      const pos = positions.get(node.id);
      if (!pos) return node;
      return { ...node, position: { x: pos.x, y: pos.y } };
    });

    // Cross-domain connection edges (visual only)
    const allEdges = [...edges];
    exploration.connections.forEach((conn) => {
      allEdges.push({
        id: conn.id,
        source: conn.sourceConceptId,
        target: conn.targetConceptId,
        label: "",
        style: {
          stroke: "#6366f1",
          strokeWidth: 1.5,
          strokeDasharray: "6 3",
        },
        animated: true,
      });
    });

    return { initialNodes: laid, initialEdges: allEdges };
  }, [exploration.lenses, exploration.connections, exploration.question]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    // Delay to let React Flow measure nodes before fitting
    const isMobile = window.innerWidth < 640;
    setTimeout(() => {
      fitView({
        padding: isMobile ? 0.02 : 0.15,
        maxZoom: isMobile ? 0.35 : 0.85,
      });
    }, 50);
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "lens") return;
      const concept = (node.data as { concept: Concept }).concept;
      setSelectedConcept(concept);
    },
    []
  );

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Concepts will appear here as the agent discovers them...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.Straight}
        colorMode="dark"
        minZoom={0.1}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#333" gap={20} />
        <Controls />
      </ReactFlow>

      {/* Legend (desktop only) */}
      {!isMobile && (
        <div className="absolute top-2 right-2 bg-card/80 backdrop-blur-sm rounded-lg p-2.5 text-xs space-y-1.5 border border-border/50">
          {exploration.lenses.map((lens, i) => (
            <div key={lens.id} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: LENS_COLORS[i % LENS_COLORS.length].border }}
              />
              <span className="text-muted-foreground">{lens.name}</span>
            </div>
          ))}
        </div>
      )}

      {selectedConcept && (
        <NodeDetail
          concept={selectedConcept}
          connections={exploration.connections.filter(
            (c) =>
              c.sourceConceptId === selectedConcept.id ||
              c.targetConceptId === selectedConcept.id
          )}
          allConcepts={exploration.lenses.flatMap((l) => l.concepts)}
          onClose={() => setSelectedConcept(null)}
        />
      )}
    </div>
  );
}

export function KnowledgeGraph({ exploration }: { exploration: Exploration }) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphInner exploration={exploration} />
    </ReactFlowProvider>
  );
}
