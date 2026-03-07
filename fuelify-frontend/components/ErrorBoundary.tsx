'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4 text-[var(--text-primary)]">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 text-center">
          <h1 className="text-xl font-black">Something went wrong</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            The page hit an unexpected error. Retry to continue.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent-primary)] px-5 py-3 text-sm font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-95"
          >
            Reload Page
          </button>
        </div>
      </main>
    );
  }
}
