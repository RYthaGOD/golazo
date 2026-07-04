import React, { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDisconnectButton } from '@solana/wallet-adapter-react-ui';
import { Package, Users, Shield, Swords, Radio } from 'lucide-react';
import SolanaLogin from './components/SolanaLogin.jsx';
import PackShop from './components/PackShop.jsx';
import CollectionGrid from './components/CollectionGrid.jsx';
import SquadBuilder from './components/SquadBuilder.jsx';
import BattleArena from './components/BattleArena.jsx';
import LiveScores from './components/LiveScores.jsx';
import { usePacks } from './solana/usePacks.js';
import { useBalance } from './solana/useBalance.js';
import { useSquad } from './game/useSquad.js';
import { SOLANA_CLUSTER, HAS_DATA_API } from './config.js';
import './index.css';

const TABS = [
  { id: 'shop', label: 'SHOP', icon: Package },
  { id: 'club', label: 'CLUB', icon: Users },
  { id: 'squad', label: 'SQUAD', icon: Shield },
  { id: 'arena', label: 'ARENA', icon: Swords },
  ...(HAS_DATA_API ? [{ id: 'live', label: 'LIVE', icon: Radio }] : []),
];

function App() {
  const { connected } = useWallet();
  const [tab, setTab] = useState('shop');

  const packsApi = usePacks();
  const balanceApi = useBalance();
  const ownedIds = useMemo(() => new Set(packsApi.collection.map(({ card }) => card.id)), [packsApi.collection]);
  const squadApi = useSquad(ownedIds);

  if (!connected) {
    return <SolanaLogin />;
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <div>
          <h1
            className="text-gradient"
            style={{
              fontSize: '34px',
              fontFamily: 'var(--font-display)',
              letterSpacing: '3px',
              textTransform: 'uppercase',
            }}
          >
            Golazo
          </h1>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginTop: '4px', fontSize: 14 }}>
            World Cup player TCG ·{' '}
            <span style={{ color: 'var(--text-main)' }}>
              {packsApi.onChain ? `on-chain packs (${SOLANA_CLUSTER})` : 'free play'}
            </span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="pill">
            {packsApi.collection.length} CARDS · {packsApi.packs.length} PACKS
          </span>
          {packsApi.onChain && balanceApi.sol != null && (
            <span className="pill" title="Devnet SOL balance">
              ◎ {balanceApi.sol.toFixed(3)} SOL
            </span>
          )}
          <WalletDisconnectButton
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.6)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: 'var(--text-muted)',
              padding: '12px 24px',
            }}
          />
        </div>
      </div>

      <nav className="tab-bar" aria-label="Game sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? 'tab-button active' : 'tab-button'} onClick={() => setTab(id)}>
            <Icon size={16} />
            {label}
            {id === 'squad' && squadApi.isLegal && <span className="tab-dot" aria-label="squad ready" />}
          </button>
        ))}
      </nav>

      {packsApi.loading && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
          SYNCING YOUR CLUB FROM DEVNET…
        </p>
      )}

      <main style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {tab === 'shop' && <PackShop packsApi={packsApi} balanceApi={balanceApi} />}
        {tab === 'club' && <CollectionGrid collection={packsApi.collection} />}
        {tab === 'squad' && <SquadBuilder collection={packsApi.collection} squadApi={squadApi} />}
        {tab === 'arena' && <BattleArena squadApi={squadApi} />}
        {tab === 'live' && <LiveScores />}
      </main>
    </div>
  );
}

export default App;
