import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">Something went wrong</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              An unexpected error occurred. Please try clearing your browser cache and signing in again.
            </p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/';
              }}
              className="bg-accent text-white px-6 py-2.5 rounded-lg hover:bg-accent-hover transition font-medium text-sm"
            >
              Clear &amp; Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
