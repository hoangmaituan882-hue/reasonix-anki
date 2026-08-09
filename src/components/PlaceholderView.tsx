import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@reasonix/ui";

interface Props {
  milestone: string;
  title: string;
  description: string;
  items: string[];
}

/** 里程碑占位视图（M1–M4 逐个替换为真实功能） */
export function PlaceholderView({ milestone, title, description, items }: Props) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-lg rx-anim-modal">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{title}</CardTitle>
            <Badge variant="secondary">{milestone}</Badge>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm text-[var(--rx-fg-dim)]">
            {items.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--rx-accent)]" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
