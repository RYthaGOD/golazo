import React from 'react';
import { motion } from 'framer-motion';
import { Package, Sparkles, Droplets } from 'lucide-react';
import PlayerCard from './PlayerCard.jsx';
import { SLOT_ODDS, FINAL_SLOT_ODDS } from '../game/packs.js';

// Rough headroom for the tx fee + pack/player account rent on top of the price.
const FEE_HEADROOM_SOL = 0.01;

/** Buy packs (devnet SOL or free play) and watch the 5-card reveal. */
export default function PackShop({ packsApi, balanceApi, edition }) {
  const { onChain, packs, packPriceSol, buying, error, buyPack, lastOpened, clearLastOpened } = packsApi;

  const needsSol =
    onChain &&
    balanceApi?.sol != null &&
    packPriceSol != null &&
    balanceApi.sol < packPriceSol + FEE_HEADROOM_SOL;

  const handleBuy = async () => {
    await buyPack();
    balanceApi?.refresh();
  };

  if (lastOpened) {
    const bestOverall = Math.max(...lastOpened.map((c) => c.overall));
    return (
      <div className="glass-panel" style={{ padding: 24 }}>
        <h2 className="text-gradient section-title">
          <Sparkles size={18} /> PACK RIPPED OPEN
        </h2>
        <div className="card-grid reveal-grid">
          {lastOpened.map((card, i) => (
            <motion.div
              key={`${card.id}-${i}`}
              initial={{ rotateY: 180, opacity: 0, y: 24 }}
              animate={{ rotateY: 0, opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.45, duration: 0.5 }}
              className={card.overall === bestOverall ? 'glow-border best-pull' : undefined}
            >
              <PlayerCard card={card} />
            </motion.div>
          ))}
        </div>
        <button className="glow-border" style={{ marginTop: 24, padding: '12px 24px' }} onClick={clearLastOpened}>
          ADD TO MY CLUB
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 className="text-gradient section-title">
        <Package size={18} /> PACK SHOP
      </h2>

      <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="pack-visual" aria-hidden="true">
          <span className="pack-ball">⚽</span>
          <span className="pack-brand">GOLAZO</span>
          <span className="pack-edition">{edition.label.toUpperCase()}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 220, flex: 1 }}>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: 14 }}>
            5 player cards per pack from the <strong>{edition.label}</strong> set ({edition.tagline}). The final
            slot is always <strong>RARE or better</strong>.
            {onChain
              ? ' Each purchase commits a seed on Solana devnet — your collection lives on-chain.'
              : ' Free-play mode: packs are stored locally, no SOL needed.'}
          </p>

          <table className="odds-table">
            <tbody>
              <tr>
                {SLOT_ODDS.map(([rarity, pct]) => (
                  <td key={rarity} data-rarity={rarity}>
                    {rarity} {pct}%
                  </td>
                ))}
              </tr>
              <tr>
                <td colSpan={SLOT_ODDS.length} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Hit slot: {FINAL_SLOT_ODDS.map(([r, p]) => `${r} ${p}%`).join(' · ')}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="glow-border"
              style={{ padding: '14px 28px', fontSize: 15 }}
              onClick={handleBuy}
              disabled={buying || needsSol}
            >
              {buying
                ? onChain
                  ? 'CONFIRMING ON DEVNET…'
                  : 'OPENING…'
                : onChain
                  ? `BUY PACK · ${packPriceSol != null ? `${packPriceSol} SOL` : '… SOL'}`
                  : 'OPEN FREE PACK'}
            </button>

            {onChain && balanceApi?.canAirdrop && (
              <button onClick={balanceApi.requestAirdrop} disabled={balanceApi.airdropping} title="Request 1 devnet SOL from the faucet">
                <Droplets size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                {balanceApi.airdropping ? 'AIRDROPPING…' : 'AIRDROP 1 SOL'}
              </button>
            )}
          </div>

          {needsSol && (
            <span style={{ fontSize: 13, color: 'var(--accent-gold)' }}>
              You need about {(packPriceSol + FEE_HEADROOM_SOL).toFixed(2)} devnet SOL for a pack — use the
              airdrop button or{' '}
              <a href="https://faucet.solana.com" target="_blank" rel="noreferrer">faucet.solana.com</a>.
            </span>
          )}

          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
            PACKS IN YOUR CLUB: {packs.length}
          </span>
        </div>
      </div>

      {packs.length === 0 && !error && (
        <div className="hint-bar">
          New here? Open a pack, check your club in <strong>CLUB</strong>, pick your five in{' '}
          <strong>SQUAD</strong>, then take them to the <strong>ARENA</strong>.
        </div>
      )}

      {(error || balanceApi?.airdropError) && (
        <div role="alert" className="error-note">
          {error || balanceApi.airdropError}
        </div>
      )}
    </div>
  );
}
