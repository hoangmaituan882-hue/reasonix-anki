import { RefreshCw } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@reasonix/ui";
import { useAnkiConnection } from "../lib/anki/useConnection";
import { inTauri } from "../lib/anki/transport";

/** 断线引导屏（技术方案 §7：连接状态机 + 引导） */
export function DisconnectedScreen() {
  const connection = useAnkiConnection();
  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-md rx-anim-modal">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full rx-pulse"
              style={{ background: "var(--rx-err)" }}
            />
            未检测到 Anki
          </CardTitle>
          <CardDescription>
            工作台通过 AnkiConnect 与本地 Anki 通信（127.0.0.1:8765），每 3 秒自动重试。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-2 text-sm text-[var(--rx-fg-dim)]">
            <li className="flex gap-2">
              <Step n={1} />
              <span>启动 Anki 桌面端</span>
            </li>
            <li className="flex gap-2">
              <Step n={2} />
              <span>
                安装 AnkiConnect 插件：工具 → 附加组件 → 获取插件，代码
                <code className="mono mx-1 rounded bg-[var(--rx-bg-soft)] px-1.5 py-0.5 text-xs">
                  2055492159
                </code>
              </span>
            </li>
            <li className="flex gap-2">
              <Step n={3} />
              <span>安装后重启 Anki，回到本窗口即可自动连上</span>
            </li>
            <li className="flex gap-2">
              <Step n={4} />
              <span>
                再安装 Reasonix 配套插件：工具 → 插件 → 从文件安装，选择应用内的
                <code className="mono mx-1 rounded bg-[var(--rx-bg-soft)] px-1.5 py-0.5 text-xs">
                  reasonix-anki-addon.ankiaddon
                </code>
                （右上角设置 → 插件与同步 可查看安装引导）
              </span>
            </li>
          </ol>
          {connection.error ? (
            <p className="text-xs text-[var(--rx-fg-faint)]">最近错误：{connection.error}</p>
          ) : null}
          {!inTauri && (
            <p className="rounded-md bg-[var(--rx-warn)]/10 px-2 py-1.5 text-xs text-[var(--rx-warn)]">
              当前为浏览器调试模式：需 Anki 与开发服务器（localhost:1420）同时运行；
              桌面版请用 <code className="mono">npm run tauri dev</code>。
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void connection.refetch()}
            className="rx-press"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            立即重试
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span
      className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold"
      style={{ background: "var(--rx-accent-soft)", color: "var(--rx-accent)" }}
    >
      {n}
    </span>
  );
}
