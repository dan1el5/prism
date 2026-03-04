import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExplorationMeta } from "@/lib/types";

export function ExplorationCard({ meta }: { meta: ExplorationMeta }) {
  return (
    <Link href={`/explore/${meta.id}`}>
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer h-full">
        <CardHeader>
          <CardTitle className="text-base leading-snug">
            {meta.question}
          </CardTitle>
          <CardDescription className="flex gap-2 mt-2">
            <Badge variant="secondary">{meta.lensCount} lenses</Badge>
            <Badge variant="secondary">{meta.conceptCount} concepts</Badge>
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
