'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  chartName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Resilient Component-Level Error Boundary.
 * Catches runtime Canvas rendering or data processing errors within individual charts
 * so that a single component failure does not crash the entire dashboard.
 */
export class ChartErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ChartErrorBoundary: ${this.props.chartName || 'Component'}]`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="h-[360px] bg-surface/90 border border-rose-500/30 rounded-xl p-6 flex flex-col items-center justify-center text-center backdrop-blur-md">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>

          <h3 className="text-sm font-semibold text-slate-100 font-mono">
            {this.props.chartName ? `${this.props.chartName} Failed` : 'Visualization Error'}
          </h3>

          <p className="text-xs text-slate-400 mt-1 max-w-sm line-clamp-2 font-mono">
            {this.state.error?.message || 'A Canvas rendering exception occurred during frame execution.'}
          </p>

          <button
            onClick={this.handleReset}
            className="mt-4 px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recover Component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChartErrorBoundary;
