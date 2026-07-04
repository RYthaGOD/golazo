# Golazo

A World Cup trading-card game on Solana devnet. Buy card packs with devnet
SOL, collect players rated from their real 2022 World Cup statistics, and
play five-a-side simulated matches against AI squads.

There is no game server and no database. Each pack purchase is a transaction:
the program takes the pack price and stores a random 32-byte seed in a
per-pack account. The client derives the pack's five cards from that seed, so
a wallet's whole collection is reconstructed from its on-chain accounts alone.

<img src="public/cards/fwd.webp" width="220" align="right" alt="Anime-style card art: a striker hitting a bicycle kick">

## Gameplay

- **Packs** — 5 cards each. The final slot is always RARE or better.
- **Cards** — 111 players from the 2022 World Cup. The four ability stats
  (ATT / PAS / DEF / PHY) are curated from each player's actual tournament;
  the overall rating and rarity tier (COMMON / RARE / ELITE / LEGEND) are
  computed from those stats, weighted by position. Every card face shows the
  player's real tournament line (appearances · goals · assists).
- **Squads** — 5 cards: exactly 1 goalkeeper, at least 1 defender and
  1 forward.
- **Matches** — simulated minute by minute with a text commentary log;
  draws are settled on penalties. Results are deterministic for a given
  pair of squads and seed. Three AI difficulty tiers.

The card artwork is original anime-style illustration (one archetype per
position) — no player likenesses are used; only factual names and statistics
appear on the cards.

## Quick start

```bash
npm install
cp .env.example .env   # ships the live devnet program id
npm run dev            # http://localhost:5173
```

Connect a Solana wallet (Phantom, Solflare, Backpack) set to **devnet** and
fund it: `solana airdrop 2 <pubkey> --url devnet`.

Without a `.env` (or with `VITE_PACK_PROGRAM_ID` left blank) the app runs in
**free play**: packs open locally with random seeds and no SOL is needed.
The header shows which mode is active.

## On-chain deployment

| | |
| --- | --- |
| Program | [`GZUkNP4HhCdqZfZdQFhruArdz5oQ4Y8mgiS9wNPWc1ZL`](https://explorer.solana.com/address/GZUkNP4HhCdqZfZdQFhruArdz5oQ4Y8mgiS9wNPWc1ZL?cluster=devnet) |
| Cluster | devnet (upgradeable) |
| Config PDA | `2UJ7aFBPr3NL7WtHwpMnFGkNbn9vfYG6zKxGueGhMDtB` |
| Pack price | 0.05 SOL |

### Instructions

| Instruction           | Signer        | Effect |
| --------------------- | ------------- | ------ |
| `initialize`          | first caller  | create the `["config"]` PDA, set the pack price, become authority |
| `buy_pack(max_price)` | anyone        | pay the price (rejected if it now exceeds `max_price`) and mint the buyer's next `["pack", buyer, n]` PDA with a committed seed |
| `set_pack_price`      | authority     | update the price |
| `withdraw`            | authority     | withdraw pack revenue, keeping the config rent-exempt |

The frontend client is IDL-free: instructions are built by hand from the
Anchor discriminators and account layouts (see
[src/solana/packs.js](src/solana/packs.js)).

## Repository layout

```
src/game/          card database, pack derivation, match simulator, storage (+ tests)
src/solana/        program client and the usePacks hook
src/components/    shop, collection, squad builder, arena
programs/golazo/   Anchor program (Rust)
scripts/           one-time config initialization
tests/             Anchor integration tests
```

## Testing

```bash
npm test        # engine, card DB, and full game-loop integration (Vitest)
npm run lint    # oxlint
```

CI runs lint, tests, and the production build on every push
([.github/workflows/ci.yml](.github/workflows/ci.yml)).

[tests/golazo.ts](tests/golazo.ts) documents the on-chain suite; running it
requires the Anchor CLI plus `ts-mocha`/`mocha`/`chai`, which are not part of
this package.json.

## Deploying the program yourself

Build with the Solana toolchain; the Anchor CLI is optional.

```bash
cargo build-sbf
solana-keygen pubkey target/deploy/golazo-keypair.json    # the program id
# put that id in programs/golazo/src/lib.rs (declare_id!) and Anchor.toml, then:
cargo build-sbf
solana program deploy target/deploy/golazo.so \
  --program-id target/deploy/golazo-keypair.json \
  --keypair <funded-devnet-wallet.json> --url devnet

# Immediately afterwards (initialize is first-come-first-served):
node scripts/init-config.mjs <PROGRAM_ID> 0.05 <funded-devnet-wallet.json>
```

After a redeploy the program id must be updated in four places:
`declare_id!` in [lib.rs](programs/golazo/src/lib.rs),
[Anchor.toml](Anchor.toml), `VITE_PACK_PROGRAM_ID` in `.env` /
[.env.example](.env.example), and the `ARG` default in the
[Dockerfile](Dockerfile) (Docker builds do not read `.env`).

## Frontend deployment

Static Vite build. The root [Dockerfile](Dockerfile) is a multi-stage build
that serves `dist/` (Railway-ready); [vercel.json](vercel.json) covers Vercel.
Public configuration is passed as build args (`VITE_SOLANA_CLUSTER`,
`VITE_PACK_PROGRAM_ID`, `VITE_SOLANA_RPC_URL`).

## Design notes and limitations

- **The card list is a frozen edition.** Pack contents are a function of
  (seed × card database), so editing [players.js](src/game/players.js) would
  re-derive every historical pack. New cards ship as a new edition.
- **Seed randomness is devnet-grade.** The pack seed is
  `keccak(buyer, count, slot, timestamp)`, which is predictable enough that a
  production release would replace it with a VRF. The client would not change.
- **Battles are simulated client-side** and are not part of on-chain state.
- Player names and statistics are factual tournament data; artwork is
  original. A commercial release would still need a review of name/statistic
  licensing (FIFPro or national associations).

## License

MIT — see [LICENSE](LICENSE).
