import React from 'react';

/**
 * Top-level error boundary. Catches render-time crashes anywhere in the tree
 * (wallet adapter, narrative feed, etc.) and shows a recoverable fallback
 * instead of a blank white screen in production.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Hook for a real monitoring service (Sentry, etc.) in production.
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px',
          padding: '24px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-deep)',
          color: 'var(--text-main)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: 'var(--accent-dramatic)',
          }}
        >
          Something went wrong
        </h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '420px', lineHeight: 1.6 }}>
          The match feed hit an unexpected error. You can try to recover without
          losing your wallet connection.
        </p>
        <button className="glow-border" onClick={this.handleReset} style={{ padding: '12px 24px' }}>
          Try again
        </button>
        {import.meta.env.DEV && (
          <pre
            style={{
              marginTop: '16px',
              maxWidth: '90vw',
              overflow: 'auto',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'left',
            }}
          >
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        )}
      </div>
    );
  }
}
