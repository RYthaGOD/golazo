#!/usr/bin/env node
/**
 * One-time initialization of the golazo program config on devnet.
 *
 *   node scripts/init-config.mjs <PROGRAM_ID> [priceSol] [keypairPath]
 *
 * Creates the ["config"] PDA with the payer as authority and the given pack
 * price (default 0.05 SOL). The instruction is built by hand (Anchor
 * discriminator + borsh u64), so no IDL is needed.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

const [programIdArg, priceSolArg = '0.05', keypairPath = '.keys/devnet-wallet.json'] = process.argv.slice(2);
if (!programIdArg) {
  console.error('Usage: node scripts/init-config.mjs <PROGRAM_ID> [priceSol] [keypairPath]');
  process.exit(1);
}

const programId = new PublicKey(programIdArg);
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keypairPath, 'utf8'))));
const priceLamports = BigInt(Math.round(Number(priceSolArg) * LAMPORTS_PER_SOL));

const configPda = PublicKey.findProgramAddressSync([Buffer.from('config')], programId)[0];

const disc = createHash('sha256').update('global:initialize').digest().subarray(0, 8);
const data = Buffer.alloc(16);
disc.copy(data, 0);
data.writeBigUInt64LE(priceLamports, 8);

const ix = new TransactionInstruction({
  programId,
  keys: [
    { pubkey: configPda, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data,
});

const connection = new Connection(process.env.SOLANA_RPC_URL || clusterApiUrl('devnet'), 'confirmed');
console.log(`Initializing config ${configPda.toBase58()} on ${programId.toBase58()}`);
console.log(`Authority: ${payer.publicKey.toBase58()}, pack price: ${priceSolArg} SOL`);

const sig = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [payer]);
console.log(`Done. Signature: ${sig}`);
