import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Droplets } from 'lucide-react';
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
      <div className="panel" style={{ padding: 24 }}>
        <h2 className="section-title">
          <Sparkles size={18} /> Pack ripped open
        </h2>
        <div className="card-grid reveal-grid">
          {lastOpened.map((card, i) => (
            <motion.div
              key={`${card.id}-${i}`}
              initial={{ rotateY: 180, opacity: 0, y: 24 }}
              animate={{ rotateY: 0, opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.45, duration: 0.5 }}
              className={card.overall === bestOverall ? 'best-pull' : undefined}
            >
              <PlayerCard card={card} />
            </motion.div>
          ))}
        </div>
        <button className="btn-primary" style={{ marginTop: 24 }} onClick={clearLastOpened}>
          Add to my club
        </button>
      </div>
    );
  }

  return (
    <div className="panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="pack-visual" aria-hidden="true">
          <span className="pack-brand">Golazo</span>
          <span className="pack-edition">{edition.label}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 240, flex: 1 }}>
          <p style={{ color: 'var(--muted)', lineHeight: 1.65, fontSize: 14 }}>
            5 player cards per pack from the <strong style={{ color: 'var(--text)' }}>{edition.label}</strong> set
            ({edition.tagline}). The final slot is always{' '}
            <strong style={{ color: 'var(--pitch-bright)' }}>rare or better</strong>.
            {onChain
              ? ' Each purchase commits a seed on Solana devnet — your collection lives on-chain.'
              : ' Free-play mode: packs are stored locally, no SOL needed.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span className="eyebrow">Slot odds</span>
            <table className="odds-table">
              <tbody>
                <tr>
                  {SLOT_ODDS.map(([rarity, pct]) => (
                    <td key={rarity} data-rarity={rarity}>
                      {rarity} <span>{pct}%</span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td colSpan={SLOT_ODDS.length} style={{ color: 'var(--muted-2)', paddingTop: 6 }}>
                    HIT SLOT · {FINAL_SLOT_ODDS.map(([r, p]) => `${r} ${p}%`).join('  ·  ')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={handleBuy} disabled={buying || needsSol}>
              {buying
                ? onChain
                  ? 'Confirming on devnet…'
                  : 'Opening…'
                : onChain
                  ? `Buy pack · ◎ ${packPriceSol ?? '…'}`
                  : 'Open free pack'}
            </button>

            {onChain && balanceApi?.canAirdrop && (
              <button
                onClick={balanceApi.requestAirdrop}
                disabled={balanceApi.airdropping}
                title="Request 1 devnet SOL from the faucet"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                <Droplets size={14} />
                {balanceApi.airdropping ? 'Airdropping…' : 'Airdrop 1 SOL'}
              </button>
            )}
          </div>

          {needsSol && (
            <span style={{ fontSize: 13, color: 'var(--gold)', lineHeight: 1.6 }}>
              You need about ◎ {(packPriceSol + FEE_HEADROOM_SOL).toFixed(2)} devnet SOL for a pack — use the
              airdrop button or <a href="https://faucet.solana.com" target="_blank" rel="noreferrer">faucet.solana.com</a>.
            </span>
          )}
        </div>
      </div>

      {packs.length === 0 && !error && (
        <div className="hint-bar">
          New here? Open a pack, check your cards in <strong>CLUB</strong>, pick your five in{' '}
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
