import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@reasonix/ui";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
  componentStack: string | null;
}

/**
 * 全局错误边界：渲染崩溃时不白屏，展示友好提示 + 重载按钮。
 * 覆盖浏览/编辑/复习/统计/今日/学习等视图的意外渲染异常。
 * 崩溃时展示组件堆栈（折叠）供诊断定位——"removeChild not a child" 等
 * DOM 竞争错误可借此找到出错组件链。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null, componentStack: null };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : null,
      componentStack: null,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 崩溃信息保留在控制台供诊断（不暴露给用户）
    console.error("Reasonix 渲染崩溃:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private reset = (): void => {
    this.setState({ hasError: false, message: null, componentStack: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--rx-r-l)] bg-[var(--rx-warn)]/15 text-[var(--rx-warn)]">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="text-base font-semibold">界面出现异常</div>
            <p className="text-xs leading-5 text-[var(--rx-fg-dim)]">
              当前视图渲染失败，应用数据未受影响。请重载恢复；
              若问题反复出现，可在设置 → 连接诊断 中查看版本信息后反馈。
            </p>
            {this.state.message && (
              <p className="break-all text-2xs text-[var(--rx-fg-faint)]">
                {this.state.message}
              </p>
            )}
          </div>
          {this.state.componentStack && (
            <details className="text-left">
              <summary className="inline-flex cursor-pointer items-center gap-1 text-2xs text-[var(--rx-fg-dim)]">
                <ChevronDown className="h-3 w-3" />
                组件堆栈（诊断）
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-[var(--rx-bg-soft)] p-2 text-left text-2xs leading-4 text-[var(--rx-fg-dim)]">
                {this.state.componentStack}
              </pre>
            </details>
          )}
          <Button onClick={this.reset} className="rx-press">
            <RefreshCw className="h-4 w-4" />
            重载界面
          </Button>
        </div>
      </div>
    );
  }
}
