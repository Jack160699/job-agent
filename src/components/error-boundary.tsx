"use client";

import { Component, type ReactNode } from "react";
import { ErrorCallout } from "@/components/ui/error-callout";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-4 sm:p-8">
            <ErrorCallout
              title="Something went wrong"
              what={this.state.error?.message || "An unexpected error occurred in this section."}
              why="A component failed to render, possibly due to missing data or a network issue."
              fix="Try refreshing the page. If the problem persists, check the logs or contact support."
              onRetry={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
            />
          </div>
        )
      );
    }

    return this.props.children;
  }
}
