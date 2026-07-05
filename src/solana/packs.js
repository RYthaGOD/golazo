import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';

/**
 * Lightweight client for the golazo pack program.
 *
 * Instructions are built by hand (Anchor discriminator + borsh args) so the
 * frontend needs no generated IDL — only the deployed program id. Every entry
 * point takes a `programId` (base58 string) because each card edition is its
 * own deployed program instance. Account layouts mirror
 * programs/golazo/src/lib.rs:
 *
 *   Config      = 8 disc | authority 32 | pack_price u64 | packs_opened u64 | bump   (57 bytes)
 *   PlayerState = 8 disc | owner 32     | packs_bought u64 | bump                    (49 bytes)
 *   Pack        = 8 disc | buyer 32     | index u64 | seed [32] | opened_at i64 | bump (89 bytes)
 */

const CONFIG_LEN = 57;
const PLAYER_LEN = 49;
const PACK_LEN = 89;

/**
 * First 8 bytes of sha256("global:buy_pack"), precomputed. Static constants
 * keep instruction building synchronous and avoid WebCrypto, which is
 * undefined on insecure (non-HTTPS, non-localhost) origins.
 */
const BUY_PACK_DISCRIMINATOR = Uint8Array.from([151, 46, 141, 93, 174, 5, 49, 173]);

const textEncoder = new TextEncoder();
const enc = (s) => textEncoder.encode(s);

const pid = (programId) => new PublicKey(programId);

export function deriveConfigPda(programId) {
  return PublicKey.findProgramAddressSync([enc('config')], pid(programId))[0];
}

export function derivePlayerPda(programId, owner) {
  return PublicKey.findProgramAddressSync([enc('player'), owner.toBuffer()], pid(programId))[0];
}

export function derivePackPda(programId, owner, index) {
  const indexLe = Buffer.alloc(8);
  indexLe.writeBigUInt64LE(BigInt(index));
  return PublicKey.findProgramAddressSync([enc('pack'), owner.toBuffer(), indexLe], pid(programId))[0];
}

const viewOf = (data) => new DataView(data.buffer, data.byteOffset);
const u64At = (data, offset) => Number(viewOf(data).getBigUint64(offset, true));
const i64At = (data, offset) => Number(viewOf(data).getBigInt64(offset, true));

/** Global config: pack price + total packs opened. Null if not initialized
 *  (or if the configured program id doesn't hold a golazo config). */
export async function fetchConfig(connection, programId) {
  const info = await connection.getAccountInfo(deriveConfigPda(programId));
  if (!info || info.data.length < CONFIG_LEN) return null;
  return {
    packPriceLamports: u64At(info.data, 40),
    packsOpened: u64At(info.data, 48),
  };
}

/** How many packs the wallet has bought (0 if it never bought one). */
export async function fetchPacksBought(connection, programId, owner) {
  const info = await connection.getAccountInfo(derivePlayerPda(programId, owner));
  return info && info.data.length >= PLAYER_LEN ? u64At(info.data, 40) : 0;
}

/**
 * All of a wallet's on-chain packs. Returns { count, packs } — `count` is
 * the on-chain counter, so callers can detect RPC reads that dropped packs
 * (packs.length < count) instead of silently shrinking the collection.
 */
export async function fetchPacks(connection, programId, owner) {
  const count = await fetchPacksBought(connection, programId, owner);
  const packs = [];
  for (let start = 0; start < count; start += 100) {
    const pdas = [];
    for (let i = start; i < Math.min(start + 100, count); i++) pdas.push(derivePackPda(programId, owner, i));
    const infos = await connection.getMultipleAccountsInfo(pdas);
    infos.forEach((info) => {
      if (!info || info.data.length < PACK_LEN) return;
      const data = info.data;
      packs.push({
        index: u64At(data, 40),
        seed: new Uint8Array(data.subarray(48, 80)),
        openedAt: i64At(data, 80),
      });
    });
  }
  return { count, packs: packs.sort((a, b) => a.index - b.index) };
}

/**
 * Build the `buy_pack(max_price)` instruction for the wallet's next pack
 * index. `maxPriceLamports` is the price the buyer was shown — the program
 * rejects the purchase if the on-chain price has been raised above it.
 */
export function buildBuyPackIx({ programId, buyer, index, maxPriceLamports }) {
  const data = Buffer.alloc(16);
  Buffer.from(BUY_PACK_DISCRIMINATOR).copy(data, 0);
  data.writeBigUInt64LE(BigInt(maxPriceLamports), 8);
  return new TransactionInstruction({
    programId: pid(programId),
    keys: [
      { pubkey: deriveConfigPda(programId), isSigner: false, isWritable: true },
      { pubkey: derivePlayerPda(programId, buyer), isSigner: false, isWritable: true },
      { pubkey: derivePackPda(programId, buyer, index), isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}
