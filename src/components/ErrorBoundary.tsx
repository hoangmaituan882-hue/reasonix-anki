import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@reasonix/ui";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
}

/**
 * 全局错误边界：渲染崩溃时不白屏，展示友好提示 + 重载按钮。
 * 覆盖浏览/编辑/复习/统计/今日/学习等视图的意外渲染异常。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : null,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 崩溃信息保留在控制台供诊断（不暴露给用户）
    console.error("Reasonix 渲染崩溃:", error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ hasError: false, message: null });
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
              <p className="text-2xs text-[var(--rx-fg-faint)]">
                {this.state.message}
              </p>
            )}
          </div>
          <Button onClick={this.reset} className="rx-press">
            <RefreshCw className="h-4 w-4" />
            重载界面
          </Button>
        </div>
      </div>
    );
  }
}
