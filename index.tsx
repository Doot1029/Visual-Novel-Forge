
import React, { PropsWithChildren } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

class ErrorBoundary extends React.Component<PropsWithChildren<{}>, { hasError: boolean, error: Error | null, errorInfo: React.ErrorInfo | null }> {
  constructor(props: PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
         <div className="fixed inset-0 bg-primary bg-opacity-95 z-[200] flex items-center justify-center p-4" aria-modal="true" role="alertdialog">
            <div className="bg-secondary rounded-lg shadow-2xl w-full max-w-2xl flex flex-col border-2 border-red-500">
                <div className="flex justify-between items-center p-4 border-b border-red-500">
                    <h2 className="text-2xl font-bold text-red-400">An Unexpected Error Occurred</h2>
                </div>
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    <p className="text-light mb-4">The application has encountered a problem and cannot continue. Please refresh the page. The technical details below can help with debugging.</p>
                    <pre className="bg-primary p-4 rounded-md text-sm text-red-300 whitespace-pre-wrap font-mono">
                        {`Error: ${this.state.error?.toString() || 'Unknown Error'}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || 'Not available'}`}
                    </pre>
                </div>
                <div className="p-4 border-t border-accent text-right">
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-6 py-2 bg-highlight text-white font-bold rounded-lg hover:bg-opacity-80"
                    >
                        Refresh Page
                    </button>
                </div>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);