import React from 'react';
import ReactDOM from 'react-dom/client';
import { monadTestnet } from 'viem/chains';
import './index.css';

import { PrivyProvider } from '@privy-io/react-auth';

import App from './App';

// Polyfills for browser environment
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;

// Set dark mode as default
document.documentElement.classList.add('dark');

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <PrivyProvider
      appId="cmevnrbmy00hwl80de1pooh7m"
      config={{
        // Create embedded wallets only for users without wallets
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets'
          }
        },
        // Allow users to connect external wallets
        loginMethods: ['wallet', 'email', 'sms'],
        // Configure supported chains
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
        // Customize appearance
        appearance: {
          theme: 'dark',
          accentColor: '#676FFF',
        }
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
);
