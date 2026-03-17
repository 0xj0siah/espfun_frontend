import { useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { motion } from 'motion/react';
import { Bot, ArrowDownToLine, TrendingUp, DollarSign, Activity, Zap } from 'lucide-react';

const placeholderTrades = [
  { time: '--:--', market: 'Player Market', action: 'BUY', size: '—', pnl: '—' },
  { time: '--:--', market: 'Player Market', action: 'SELL', size: '—', pnl: '—' },
  { time: '--:--', market: 'Player Market', action: 'BUY', size: '—', pnl: '—' },
];

export default function AgentSection() {
  const [depositAmount, setDepositAmount] = useState('');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center space-x-3"
        >
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              AI Trading Agent
            </h2>
            <p className="text-sm text-muted-foreground">Powered by Virtuals AGDP</p>
          </div>
        </motion.div>
        <Badge variant="secondary" className="bg-accent text-muted-foreground border-0">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 inline-block mr-2" />
          Offline
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agent Overview Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card className="p-6 border-0 shadow-lg">
              <h3 className="mb-6 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-blue-500" />
                Agent Overview
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-accent/30 rounded-xl p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">Agent Wallet</p>
                  <p className="text-sm font-medium text-muted-foreground">Not deployed</p>
                </div>
                <div className="bg-accent/30 rounded-xl p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">USDC Balance</p>
                  <p className="text-sm font-medium text-muted-foreground">—</p>
                </div>
                <div className="bg-accent/30 rounded-xl p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">Total P&L</p>
                  <p className="text-sm font-medium text-muted-foreground">—</p>
                </div>
                <div className="bg-accent/30 rounded-xl p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-medium text-muted-foreground">Idle</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-border/40 bg-accent/10 px-4 py-3 flex items-center space-x-3">
                <Zap className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Deposit USDC to deploy your agent. Once live, it will autonomously trade esports player markets on your behalf using the Virtuals AGDP framework.
                </p>
              </div>
            </Card>
          </motion.div>

          {/* Trade Activity Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6 border-0 shadow-lg">
              <h3 className="mb-6 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-purple-500" />
                Trade Activity
              </h3>
              {/* Table header */}
              <div className="grid grid-cols-5 text-xs text-muted-foreground uppercase tracking-wide mb-3 px-4">
                <span>Time</span>
                <span>Market</span>
                <span>Action</span>
                <span>Size (USDC)</span>
                <span>P&L</span>
              </div>
              <div className="space-y-2">
                {placeholderTrades.map((trade, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.12 + index * 0.04 }}
                    className="grid grid-cols-5 items-center p-4 rounded-xl bg-accent/30 text-sm text-muted-foreground"
                  >
                    <span>{trade.time}</span>
                    <span>{trade.market}</span>
                    <span className={trade.action === 'BUY' ? 'text-green-500' : 'text-red-500'}>
                      {trade.action}
                    </span>
                    <span>{trade.size}</span>
                    <span>{trade.pnl}</span>
                  </motion.div>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">
                No trades yet — activate your agent to begin
              </p>
            </Card>
          </motion.div>
        </div>

        {/* Right panel */}
        <div className="space-y-6">
          {/* Deposit USDC Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <Card className="p-6 border-0 shadow-lg">
              <h3 className="mb-5 flex items-center">
                <ArrowDownToLine className="w-5 h-5 mr-2 text-blue-500" />
                Deposit USDC
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Amount (USDC)</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="bg-accent/30 border-border/40"
                    min="0"
                  />
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0"
                  disabled
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Deposit
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Funds are used by your agent to trade esports player markets
                </p>
              </div>
            </Card>
          </motion.div>

          {/* Agent Stats Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
          >
            <Card className="p-6 border-0 shadow-lg">
              <h3 className="mb-5 flex items-center">
                <Bot className="w-5 h-5 mr-2 text-purple-500" />
                Agent Info
              </h3>
              <div className="bg-accent/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Deposited</span>
                  <span className="font-medium">—</span>
                </div>
                <div className="h-px bg-border/30" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Active Since</span>
                  <span className="font-medium text-muted-foreground">Not started</span>
                </div>
                <div className="h-px bg-border/30" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Framework</span>
                  <span className="font-medium">Virtuals AGDP</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
