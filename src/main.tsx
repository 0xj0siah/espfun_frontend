import React from 'react';
import ReactDOM from 'react-dom/client';
// Replace this with any of the networks listed at https://github.com/wevm/viem/blob/main/src/chains/index.ts
import {monadTestnet} from 'viem/chains';
import './index.css';

import {PrivyProvider} from '@privy-io/react-auth';

import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <PrivyProvider
      appId="cmevnrbmy00hwl80de1pooh7m"
      config={{
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets'
          }
        },
        defaultChain: monadTestnet,

        supportedChains: [monadTestnet]
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
);
