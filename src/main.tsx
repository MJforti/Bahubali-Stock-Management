import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './index.css';
import { registerServiceWorker } from './pwa';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled app error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#141415] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-sm w-full rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-medium">Something went wrong</h2>
            <p className="mt-2 text-sm text-slate-400">
              {this.state.error?.message || 'The app hit an unexpected error.'} Your stock data is kept on this device.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 w-full h-10 rounded-lg bg-slate-100 text-slate-950 text-sm font-medium hover:bg-white transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

registerServiceWorker();
