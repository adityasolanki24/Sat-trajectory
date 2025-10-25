import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fullScreen?: boolean;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    try {
      this.props.onError?.(error);
    } catch {}
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fullScreen) {
        return (
          <div style={{
            padding: '2rem',
            background: '#1a237e',
            color: '#fff',
            minHeight: '100vh',
            fontFamily: 'Arial, sans-serif'
          }}>
            <h1>🚨 Error Loading Application</h1>
            <p>Something went wrong. Please refresh the page.</p>
            <details style={{ marginTop: '1rem' }}>
              <summary>Error Details</summary>
              <pre style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                padding: '1rem', 
                borderRadius: '4px',
                marginTop: '0.5rem',
                fontSize: '0.8rem'
              }}>
                {this.state.error?.toString()}
              </pre>
            </details>
            <button 
              onClick={() => window.location.reload()}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: '#64b5f6',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Refresh Page
            </button>
          </div>
        );
      }
      return (
        <div style={{
          background: 'rgba(244, 67, 54, 0.2)',
          border: '1px solid #f44336',
          borderRadius: '8px',
          padding: '1rem',
          color: '#fff'
        }}>
          <strong>⚠️ Component failed to load.</strong>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.9 }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
