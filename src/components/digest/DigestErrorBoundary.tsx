"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props   { children: ReactNode }
interface State   { hasError: boolean }

export class DigestErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[DigestErrorBoundary]", error, info);
  }

  handleReset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-400 text-xl">
            ✕
          </div>
          <div>
            <p className="font-serif text-lg text-gray-700 mb-1">
              Could not load digest
            </p>
            <p className="text-sm text-gray-400">
              Something went wrong on our end. Try refreshing the page.
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="px-5 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
