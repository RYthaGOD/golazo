import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { openPack } from './game/packs.js';

/**
 * Full game-loop integration test (free-play mode, mocked wallet):
 * shop → open pack → club → squad building → arena battle to a result.
 */

const TEST_PUBKEY = 'GoLazoTestWallet1111111111111111111111111111';

// One stable wallet object: the real adapter keeps `publicKey` referentially
// stable across renders, and hooks depend on that (a fresh object per render
// would re-fire their refresh effects forever).
const { mockWallet, mockConnectionCtx } = vi.hoisted(() => ({
  mockWallet: {
    connected: true,
    publicKey: { toBase58: () => 'GoLazoTestWallet1111111111111111111111111111' },
    sendTransaction: () => {},
  },
  mockConnectionCtx: { connection: {} },
}));

// Force free-play mode regardless of the developer's .env (which wires the
// real devnet program id into on-chain mode).
vi.mock('./config.js', () => ({
  SOLANA_CLUSTER: 'devnet',
  SOLANA_RPC_URL: 'http://127.0.0.1:8899',
  PACK_PROGRAM_ID: '',
  HAS_PACK_PROGRAM: false,
  DATA_API_URL: '',
  HAS_DATA_API: false,
}));

// framer-motion's rAF loops run away under jsdom (heap exhaustion) — render
// plain elements instead; animation is not under test here.
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_, tag) =>
        function MotionMock({
          children,
          initial: _initial,
          animate: _animate,
          exit: _exit,
          transition: _transition,
          whileHover: _whileHover,
          whileTap: _whileTap,
          ...props
        }) {
          return React.createElement(tag, props, children);
        },
    },
  ),
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => mockWallet,
  useConnection: () => mockConnectionCtx,
}));

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletMultiButton: (props) => <button {...props}>CONNECT</button>,
  WalletDisconnectButton: (props) => <button {...props}>DISCONNECT</button>,
}));

// Pre-seeded free-play packs: deterministic seeds → deterministic collection.
const SEEDS = Array.from({ length: 8 }, (_, i) => `e2e-pack-${i}`);
const ownedCards = () => {
  const byId = new Map();
  for (const seed of SEEDS) for (const card of openPack(seed)) byId.set(card.id, card);
  return [...byId.values()];
};

const pickSquad = (cards) => {
  const gk = cards.find((c) => c.pos === 'GK');
  const def = cards.find((c) => c.pos === 'DEF');
  const fwd = cards.find((c) => c.pos === 'FWD');
  const rest = cards.filter((c) => ![gk?.id, def?.id, fwd?.id].includes(c.id) && c.pos !== 'GK').slice(0, 2);
  return [gk, def, fwd, ...rest];
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(`golazo:packs:${TEST_PUBKEY}`, JSON.stringify(SEEDS));
});

describe('Golazo game loop', () => {
  it('shows the shop with pre-seeded packs counted', async () => {
    render(<App />);
    expect(await screen.findByText('PACK SHOP')).toBeInTheDocument();
    expect(screen.getByText(`PACKS IN YOUR CLUB: ${SEEDS.length}`)).toBeInTheDocument();
  });

  it('opens a free pack and adds it to the club', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /OPEN FREE PACK/i }));
    expect(await screen.findByText('PACK RIPPED OPEN')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ADD TO MY CLUB/i }));
    expect(await screen.findByText(`PACKS IN YOUR CLUB: ${SEEDS.length + 1}`)).toBeInTheDocument();
  });

  it('shows the owned collection in the club tab', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^CLUB$/i }));
    const owned = ownedCards();
    expect(await screen.findByText(new RegExp(`^${owned.length}/\\d+ UNIQUE CARDS$`))).toBeInTheDocument();
    // Spot-check one owned card is on screen
    expect(screen.getAllByText(owned[0].name).length).toBeGreaterThan(0);
  });

  it('builds a legal squad and wins or loses a full arena battle', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Arena refuses play without a legal squad
    await user.click(screen.getByRole('button', { name: /^ARENA$/i }));
    expect(await screen.findByText(/FIELD A LEGAL SQUAD FIRST/i)).toBeInTheDocument();

    // Build the squad from owned cards (1 GK, 1+ DEF, 1+ FWD)
    await user.click(screen.getByRole('button', { name: /^SQUAD$/i }));
    const squad = pickSquad(ownedCards());
    expect(squad.every(Boolean)).toBe(true);
    const pickerTitle = await screen.findByText('PICK FROM YOUR CLUB');
    const picker = pickerTitle.closest('.glass-panel');
    for (const card of squad) {
      await user.click(within(picker).getByText(card.name).closest('button'));
    }
    expect(await screen.findByText(/SQUAD READY/i)).toBeInTheDocument();

    // Fight! Skip playback straight to full time and expect a result.
    await user.click(screen.getByRole('button', { name: /^ARENA$/i }));
    await user.click(await screen.findByRole('button', { name: /KICK OFF/i }));
    await user.click(await screen.findByRole('button', { name: /skip to full time/i }));
    expect(await screen.findByText(/VICTORY!|DEFEAT\./)).toBeInTheDocument();
    expect(screen.getByText(/RECORD: (1W – 0L|0W – 1L)/)).toBeInTheDocument();

    // The battle wrote the record to this wallet's storage
    const record = JSON.parse(localStorage.getItem(`golazo:record:${TEST_PUBKEY}`));
    expect(record.w + record.l).toBe(1);
  });

  it('remembers the saved squad across sessions (wallet reconnect)', async () => {
    const squad = pickSquad(ownedCards());
    localStorage.setItem(`golazo:squad:${TEST_PUBKEY}`, JSON.stringify(squad.map((c) => c.id)));
    const user = userEvent.setup();
    render(<App />);
    // The tab's accessible name includes the "squad ready" dot's aria-label.
    await user.click(screen.getByRole('button', { name: /^SQUAD\b/i }));
    expect(await screen.findByText(/SQUAD READY/i)).toBeInTheDocument();
    expect(screen.getByText(`STARTING FIVE (5/5)`)).toBeInTheDocument();
  });
});
