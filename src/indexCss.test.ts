import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as { dependencies?: Record<string, string> };

describe("global UI stylesheet wiring", () => {
  it("loads shadcn state variants before Reasonix UI styles", () => {
    const shadcn = '@import "shadcn/tailwind.css";';
    const reasonix = '@import "@reasonix/ui/styles.css";';

    expect(css).toContain(shadcn);
    expect(css.indexOf(shadcn)).toBeLessThan(css.indexOf(reasonix));
  });

  it("declares packages that application source imports directly", () => {
    expect(packageJson.dependencies).toHaveProperty("shadcn");
    expect(packageJson.dependencies).toHaveProperty("lucide-react");
  });
});
