import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { WAGER_PROGRAM_ID } from '../config.js';

/**
 * IDL-free client for the wager program (PvP staked battles).
 *
 * Match account layout (after the 8-byte discriminator):
 *   creator 32 | opponent 32 | winner 32 | stake u64 | created_at i64 |
 *   nonce u64 | seed [32] | creator_power u16 | opponent_power u16 |
 *   state u8 | bump u8 | creator_squad String | opponent_squad String
 */

const DISC = {
  create_match: Uint8Array.from([107, 2, 184, 145, 70, 142, 17, 165]),
  join_match: Uint8Array.from([244, 8, 47, 130, 192, 59, 179, 44]),
  cancel_match: Uint8Array.from([142, 136, 247, 45, 92, 112, 180, 83]),
};

const enc = new TextEncoder();
export const programId = () => new PublicKey(WAGER_PROGRAM_ID);

export function deriveMatchPda(creator, nonce) {
  const n = Buffer.alloc(8);
  n.writeBigUInt64LE(BigInt(nonce));
  return PublicKey.findProgramAddressSync([enc.encode('match'), creator.toBuffer(), n], programId())[0];
}

const borshString = (s) => {
  const bytes = enc.encode(s);
  const buf = Buffer.alloc(4 + bytes.length);
  buf.writeUInt32LE(bytes.length, 0);
  Buffer.from(bytes).copy(buf, 4);
  return buf;
};

/** create_match(nonce u64, stake u64, power u16, squad String) */
export function buildCreateMatchIx({ creator, nonce, stakeLamports, power, squad }) {
  const head = Buffer.alloc(8 + 8 + 8 + 2);
  Buffer.from(DISC.create_match).copy(head, 0);
  head.writeBigUInt64LE(BigInt(nonce), 8);
  head.writeBigUInt64LE(BigInt(stakeLamports), 16);
  head.writeUInt16LE(power & 0xffff, 24);
  const data = Buffer.concat([head, borshString(squad)]);
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      { pubkey: deriveMatchPda(creator, nonce), isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** join_match(power u16, squad String) — resolves + pays the pot on-chain. */
export function buildJoinMatchIx({ matchPda, creator, opponent, power, squad }) {
  const head = Buffer.alloc(8 + 2);
  Buffer.from(DISC.join_match).copy(head, 0);
  head.writeUInt16LE(power & 0xffff, 8);
  const data = Buffer.concat([head, borshString(squad)]);
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      { pubkey: matchPda, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: false, isWritable: true },
      { pubkey: opponent, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** cancel_match() — creator reclaims stake + rent while still open. */
export function buildCancelMatchIx({ matchPda, creator }) {
  return new TransactionInstruction({
    programId: programId(),
    keys: [
      { pubkey: matchPda, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
    ],
    data: Buffer.from(DISC.cancel_match),
  });
}

const bs58keyAt = (data, off) => new PublicKey(data.subarray(off, off + 32));

/** Decode a Match account's data buffer into a plain object. */
export function parseMatch(pubkey, data) {
  const view = new DataView(data.buffer, data.byteOffset);
  let o = 8;
  const creator = bs58keyAt(data, o); o += 32;
  const opponent = bs58keyAt(data, o); o += 32;
  const winner = bs58keyAt(data, o); o += 32;
  const stake = Number(view.getBigUint64(o, true)); o += 8;
  const createdAt = Number(view.getBigInt64(o, true)); o += 8;
  const nonce = view.getBigUint64(o, true); o += 8;
  const seed = new Uint8Array(data.subarray(o, o + 32)); o += 32;
  const creatorPower = view.getUint16(o, true); o += 2;
  const opponentPower = view.getUint16(o, true); o += 2;
  const state = data[o]; o += 1;
  o += 1; // bump
  const readStr = () => {
    const len = view.getUint32(o, true); o += 4;
    const s = new TextDecoder().decode(data.subarray(o, o + len)); o += len;
    return s;
  };
  const creatorSquad = readStr();
  const opponentSquad = readStr();
  return {
    pubkey: pubkey.toBase58(),
    creator: creator.toBase58(),
    opponent: opponent.toBase58(),
    winner: winner.toBase58(),
    stake,
    createdAt,
    nonce: nonce.toString(),
    seed,
    creatorPower,
    opponentPower,
    state, // 0 open, 1 resolved
    creatorSquad: creatorSquad ? creatorSquad.split(',') : [],
    opponentSquad: opponentSquad ? opponentSquad.split(',') : [],
  };
}

const OPEN = 0;

/** All currently-open challenges (state byte == Open). */
export async function fetchOpenMatches(connection) {
  // state offset: 8 disc + 32*3(creator,opponent,winner) + 8+8+8(stake,created,nonce) + 32(seed) + 2+2(powers) = 164
  const accounts = await connection.getProgramAccounts(programId(), {
    filters: [{ memcmp: { offset: 164, bytes: '1' } }], // base58 of a single 0x00 byte
  });
  return accounts
    .map(({ pubkey, account }) => parseMatch(pubkey, account.data))
    .filter((m) => m.state === OPEN)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** A wallet's matches (created or joined), for its history/results. */
export async function fetchMyMatches(connection, owner) {
  const asCreator = await connection.getProgramAccounts(programId(), {
    filters: [{ memcmp: { offset: 8, bytes: owner.toBase58() } }],
  });
  const asOpponent = await connection.getProgramAccounts(programId(), {
    filters: [{ memcmp: { offset: 40, bytes: owner.toBase58() } }],
  });
  const seen = new Set();
  return [...asCreator, ...asOpponent]
    .filter(({ pubkey }) => (seen.has(pubkey.toBase58()) ? false : seen.add(pubkey.toBase58())))
    .map(({ pubkey, account }) => parseMatch(pubkey, account.data))
    .sort((a, b) => b.createdAt - a.createdAt);
}
