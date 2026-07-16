import React, { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDisconnectButton } from '@solana/wallet-adapter-react-ui';
import { Package, Users, Shield, Swords, Radio, Coins } from 'lucide-react';
import SolanaLogin from './components/SolanaLogin.jsx';
import PackShop from './components/PackShop.jsx';
import CollectionGrid from './components/CollectionGrid.jsx';
import SquadBuilder from './components/SquadBuilder.jsx';
import BattleArena from './components/BattleArena.jsx';
import LiveScores from './components/LiveScores.jsx';
import WagerArena from './components/WagerArena.jsx';
import EditionSwitcher from './components/EditionSwitcher.jsx';
import { usePacks } from './solana/usePacks.js';
import { useBalance } from './solana/useBalance.js';
import { useSquad } from './game/useSquad.js';
import { getEdition, DEFAULT_EDITION_ID } from './game/editions.js';
import { SOLANA_CLUSTER, HAS_DATA_API, HAS_WAGER } from './config.js';
import './index.css';

// Each tab owns the page headline, so the panels below don't repeat it.
const TABS = [
  {
    id: 'shop',
    label: 'SHOP',
    icon: Package,
    title: 'Pack shop.',
    blurb: 'Five player cards a pack. The final slot is always rare or better.',
  },
  {
    id: 'club',
    label: 'CLUB',
    icon: Users,
    title: 'My club.',
    blurb: 'Every card you own, filtered by position and rarity.',
  },
  {
    id: 'squad',
    label: 'SQUAD',
    icon: Shield,
    title: 'Starting five.',
    blurb: 'One keeper, at least one defender, at least one forward.',
  },
  {
    id: 'arena',
    label: 'ARENA',
    icon: Swords,
    title: 'Battle arena.',
    blurb: '5v5 against a seeded AI side. Nothing staked, nothing lost.',
  },
  ...(HAS_WAGER
    ? [{
        id: 'wager',
        label: 'WAGER',
        icon: Coins,
        title: 'Wager arena.',
        blurb: 'Stake devnet SOL against a rival. The winner is rolled on-chain.',
      }]
    : []),
  ...(HAS_DATA_API
    ? [{
        id: 'live',
        label: 'SCORES',
        icon: Radio,
        title: 'World Cup 2026.',
        blurb: 'Group-stage results from the TxODDS TxLINE feed — the data the cards are rated from.',
      }]
    : []),
];

const Stat = ({ label, value }) => (
  <div className="stat">
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
  </div>
);

function App() {
  const { connected } = useWallet();
  const [tab, setTab] = useState('shop');
  const [editionId, setEditionId] = useState(DEFAULT_EDITION_ID);
  const edition = getEdition(editionId);

  const packsApi = usePacks(edition);
  const balanceApi = useBalance();
  const ownedIds = useMemo(() => new Set(packsApi.collection.map(({ card }) => card.id)), [packsApi.collection]);
  const squadApi = useSquad(ownedIds, edition);

  if (!connected) {
    return <SolanaLogin />;
  }

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <span className="nav-logo">Golazo</span>
          <span className="nav-badge">TCG</span>
          <span className="nav-spacer" />
          <EditionSwitcher editionId={editionId} onChange={setEditionId} />
          <span className="pill">{packsApi.onChain ? SOLANA_CLUSTER : 'free play'}</span>
          <span className="nav-wallet">
            <WalletDisconnectButton />
          </span>
        </div>
      </header>

      <div className="app-shell">
        <div className="page-head">
          <div>
            <span className="hero-eyebrow">
              {edition.label} · {edition.tagline}
            </span>
            <h1 className="page-title">{active.title}</h1>
            <p className="page-blurb">{active.blurb}</p>
          </div>

          <div className="stat-rail">
            <Stat label="Cards" value={packsApi.collection.length} />
            <Stat label="Packs" value={packsApi.packs.length} />
            {packsApi.onChain && balanceApi.sol != null && (
              <Stat label="Balance" value={`◎ ${balanceApi.sol.toFixed(3)}`} />
            )}
          </div>
        </div>

        <nav className="tab-bar" aria-label="Game sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={tab === id ? 'tab-button active' : 'tab-button'} onClick={() => setTab(id)}>
              <Icon size={15} />
              {label}
              {id === 'squad' && squadApi.isLegal && <span className="tab-dot" aria-label="squad ready" />}
            </button>
          ))}
        </nav>

        {packsApi.loading && (
          <p className="eyebrow" style={{ color: 'var(--muted-2)' }}>
            Syncing your club from devnet…
          </p>
        )}

        <main style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {tab === 'shop' && <PackShop packsApi={packsApi} balanceApi={balanceApi} edition={edition} />}
          {tab === 'club' && <CollectionGrid collection={packsApi.collection} edition={edition} title={null} />}
          {tab === 'squad' && <SquadBuilder collection={packsApi.collection} squadApi={squadApi} />}
          {tab === 'arena' && <BattleArena squadApi={squadApi} edition={edition} />}
          {tab === 'wager' && <WagerArena squadApi={squadApi} />}
          {tab === 'live' && <LiveScores />}
        </main>
      </div>
    </>
  );
}

export default App;
