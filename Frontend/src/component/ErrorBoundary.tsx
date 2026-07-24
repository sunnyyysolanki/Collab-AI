import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

// Catches render-time errors in the subtree so one bad component (e.g. a
// JSON.parse throwing on a malformed AI message) can't white-screen the app.
class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReset = () => this.setState({ hasError: false, message: undefined });

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-4 m-4 rounded-md bg-red-900 text-red-100">
            <p className="font-semibold">Something went wrong rendering this view.</p>
            {this.state.message && (
              <p className="text-sm mt-1 opacity-80">{this.state.message}</p>
            )}
            <button
              onClick={this.handleReset}
              className="mt-3 px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm"
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
