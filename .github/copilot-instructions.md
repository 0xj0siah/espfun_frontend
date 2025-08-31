# Copilot Instructions for Crypto Fantasy Esports App

## Overview
This project is a modern, modular React (Vite) app for a crypto fantasy esports platform. It uses Privy for wallet authentication and embedded wallet actions, and is styled with custom UI components. The app is organized by feature sections (Team, Transfers, Live Scores, Leaderboard, Pack Opening) and is designed for extensibility and rapid UI iteration.

## Architecture & Patterns
- **Entry Point:** `src/main.tsx` wraps the app in `PrivyProvider` and sets up the blockchain network (see `base` from `viem/chains`).
- **App Shell:** `src/App.tsx` manages the main navigation and renders the active section. Tabs are managed via `activeTab` state.
- **Sections:** Each major feature is a component in `src/components/` (e.g., `TeamSection.tsx`, `TransfersSection.tsx`). These are rendered by `App.tsx` based on the selected tab.
- **UI Components:** All UI primitives (Button, Card, Dialog, etc.) are in `src/components/ui/`. Use these for consistent styling and behavior.
- **Wallet Integration:** Privy is used for authentication and wallet actions. Use the `usePrivy` hook for login, logout, wallet state, and embedded wallet actions (see `Header.tsx` and `PlayerPurchaseModal.tsx`).
- **Data Flow:** Team/player data is fetched from a remote API (see `TeamSection.tsx`). Update state via React hooks. Purchases/sales are handled by sending transactions through the embedded wallet.
- **Modal Patterns:** Modals (e.g., `PlayerPurchaseModal.tsx`) are controlled by parent state. Show the modal by setting the selected player and open state.

## Developer Workflows
- **Install:** `npm i`
- **Dev Server:** `npm run dev`
- **Wallet Testing:** Use the Privy test appId or your own. Embedded wallet actions (send, buy, sell) are available after login.
- **API Mocking:** Team/player data is fetched from a Pinata IPFS endpoint. Replace with your own API as needed.
- **Styling:** Use Tailwind utility classes and the custom UI components in `ui/`.

## Project-Specific Conventions
- **Tab Navigation:** All main sections are switched via the `activeTab` state in `App.tsx` and rendered as separate components.
- **Player Actions:** All buy/sell actions are handled via the `PlayerPurchaseModal.tsx`, which supports slippage and Uniswap-style UI for input/outputs.
- **No Spinner Inputs:** Numeric inputs for ETH amounts use a `.no-spinner` class to hide browser increment/decrement controls (see `PlayerPurchaseModal.tsx` and add CSS if needed).
- **Component Structure:** Prefer feature-based folders and keep UI primitives in `ui/`.
- **Wallet UI:** Use `showWallet()` from Privy to open the wallet modal for deposits.

## Integration Points
- **Privy:** See `main.tsx` for provider setup and `Header.tsx`/`PlayerPurchaseModal.tsx` for usage.
- **API:** Team/player data is fetched from a remote endpoint in `TeamSection.tsx`.
- **Figma:** The design is based on a Figma file (see README for link).

## Examples
- To add a new section, create a component in `src/components/`, add it to `App.tsx`, and update the tab list.
- To add a new UI primitive, add it to `src/components/ui/` and use it throughout the app.
- To trigger a wallet action, use the `usePrivy` hook and call the relevant method (e.g., `login`, `logout`, `showWallet`, `wallet.embeddedWallet.sendTransaction`).

## References
- `src/App.tsx`, `src/main.tsx`, `src/components/Header.tsx`, `src/components/TeamSection.tsx`, `src/components/PlayerPurchaseModal.tsx`, `src/components/ui/`
- [Privy Docs](https://docs.privy.io/)
- [Figma Design](https://www.figma.com/design/Iikyl8bGoFfWQYEqSN9vAm/Crypto-Fantasy-Esports-App)
