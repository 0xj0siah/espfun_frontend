import { useState } from 'react';
import Header from './components/Header';
import TeamSection from './components/TeamSection';
import TransfersSection from './components/TransfersSection';
import LiveScoresSection from './components/LiveScoresSection';
import LeaderboardSection from './components/LeaderboardSection';
import PackOpeningSection from './components/PackOpeningSection';

// Import debug utility
import './utils/contractDebug';

export default function App() {
  const [activeTab, setActiveTab] = useState('Team');

  const renderContent = () => {
    switch (activeTab) {
      case 'Team':
        return <TeamSection />;
      case 'Transfers':
        return <TransfersSection />;
      case 'Live Scores':
        return <LiveScoresSection />;
      case 'Leaderboard':
        return <LeaderboardSection />;
      case 'Pack Opening':
        return <PackOpeningSection />;
      default:
        return <TeamSection />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
      
      {/* Background decorative elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/5 to-purple-600/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-green-500/5 to-emerald-600/5 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
}