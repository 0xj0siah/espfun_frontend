import { useEffect, useState } from 'react';

// Simple debug component to monitor authentication requests
export const AuthDebugger = () => {
  const [requestCount, setRequestCount] = useState(0);
  const [lastRequest, setLastRequest] = useState<string>('');

  useEffect(() => {
    // Monitor console errors
    const originalError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('Authentication') || message.includes('auth') || message.includes('token')) {
        setRequestCount(prev => prev + 1);
        setLastRequest(message.substring(0, 100));
      }
      originalError.apply(console, args);
    };

    // Monitor console logs
    const originalLog = console.log;
    console.log = (...args) => {
      const message = args.join(' ');
      if (message.includes('Authentication') || message.includes('auth') || message.includes('Backend')) {
        setRequestCount(prev => prev + 1);
        setLastRequest(message.substring(0, 100));
      }
      originalLog.apply(console, args);
    };

    return () => {
      console.error = originalError;
      console.log = originalLog;
    };
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-2 rounded text-xs max-w-xs z-50">
      <div>Auth Requests: {requestCount}</div>
      {lastRequest && <div className="truncate">Last: {lastRequest}</div>}
      <button 
        onClick={() => { setRequestCount(0); setLastRequest(''); }}
        className="text-blue-300 hover:text-blue-100"
      >
        Reset
      </button>
    </div>
  );
};
