import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export const BackendStatus = () => {
  const [status, setStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        // Try to get a nonce as a simple health check
        await apiService.getBuyTokensNonce('0x0000000000000000000000000000000000000000');
        setStatus('available');
      } catch (error) {
        console.log('Backend unavailable, will use local signature generation');
        setStatus('unavailable');
      }
    };

    checkBackendStatus();
  }, []);

  if (status === 'checking') {
    return (
      <div className="flex items-center text-xs text-gray-500">
        <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse"></div>
        Checking backend...
      </div>
    );
  }

  return (
    <div className="flex items-center text-xs text-gray-500">
      <div className={`w-2 h-2 rounded-full mr-2 ${
        status === 'available' ? 'bg-green-500' : 'bg-orange-500'
      }`}></div>
      Signatures: {status === 'available' ? 'Backend' : 'Local'}
    </div>
  );
};
