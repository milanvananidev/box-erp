import { Component, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ErrorState } from "./states";

class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidCatch(error: unknown) {
    console.error("[BoxERP] render error", error);
  }
  render() {
    if (this.state.error)
      return (
        <ErrorState
          title="Something went wrong on this screen"
          error={this.state.error}
          onRetry={() => this.setState({ error: null })}
        />
      );
    return this.props.children;
  }
}

/** Resets automatically when the user navigates to another page. */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary key={pathname}>{children}</Boundary>;
}
