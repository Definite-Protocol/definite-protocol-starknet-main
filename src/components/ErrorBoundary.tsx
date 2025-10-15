import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo);
    
    // You can also log the error to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white bg-opacity-10 backdrop-blur-sm p-8 border border-white border-opacity-20 rounded-lg text-center">
            <div className="text-red-400 mb-4">
              <AlertTriangle size={48} className="mx-auto" />
            </div>
            
            <h2 className="text-xl font-semibold text-white mb-4">
              Something went wrong
            </h2>
            
            <p className="text-white text-opacity-70 mb-6 text-sm">
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>
            
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-white text-opacity-60 text-xs cursor-pointer mb-2">
                  Error Details (Development)
                </summary>
                <pre className="text-red-300 text-xs bg-black bg-opacity-50 p-3 rounded overflow-auto max-h-32">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            
            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full bg-[#6e6aff] hover:bg-[#5b57e6] text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center"
              >
                <RefreshCw size={16} className="mr-2" />
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full border border-white border-opacity-20 text-white px-6 py-3 rounded-lg font-semibold transition-colors hover:bg-white hover:bg-opacity-5"
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

export default ErrorBoundary;