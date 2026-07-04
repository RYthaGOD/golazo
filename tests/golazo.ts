import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as assert from "assert";

/**
 * Anchor integration tests for the golazo pack program.
 * Runs against a local validator via `anchor test`.
 */
describe("golazo", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Golazo as Program;
  const authority = provider.wallet;

  const PACK_PRICE = Math.round(0.05 * LAMPORTS_PER_SOL);

  const configPda = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  )[0];
  const playerPda = PublicKey.findProgramAddressSync(
    [Buffer.from("player"), authority.publicKey.toBuffer()],
    program.programId
  )[0];
  const packPda = (index: number) =>
    PublicKey.findProgramAddressSync(
      [
        Buffer.from("pack"),
        authority.publicKey.toBuffer(),
        new anchor.BN(index).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];

  it("initializes the config", async () => {
    await program.methods
      .initialize(new anchor.BN(PACK_PRICE))
      .accounts({
        config: configPda,
        authority: authority.publicKey,
      })
      .rpc();

    const config = await (program.account as any).config.fetch(configPda);
    assert.strictEqual(config.packPrice.toNumber(), PACK_PRICE);
    assert.strictEqual(config.packsOpened.toNumber(), 0);
    assert.ok(config.authority.equals(authority.publicKey));
  });

  it("buys two packs with distinct committed seeds", async () => {
    for (let i = 0; i < 2; i++) {
      await program.methods
        .buyPack(new anchor.BN(PACK_PRICE))
        .accounts({
          config: configPda,
          player: playerPda,
          pack: packPda(i),
          buyer: authority.publicKey,
        })
        .rpc();
    }

    const player = await (program.account as any).playerState.fetch(playerPda);
    assert.strictEqual(player.packsBought.toNumber(), 2);

    const pack0 = await (program.account as any).pack.fetch(packPda(0));
    const pack1 = await (program.account as any).pack.fetch(packPda(1));
    assert.notDeepStrictEqual(pack0.seed, pack1.seed);
    assert.strictEqual(pack0.index.toNumber(), 0);
    assert.strictEqual(pack1.index.toNumber(), 1);

    const config = await (program.account as any).config.fetch(configPda);
    assert.strictEqual(config.packsOpened.toNumber(), 2);
  });

  it("collects pack revenue into the config and lets the authority withdraw", async () => {
    const before = await provider.connection.getBalance(configPda);
    assert.ok(before >= 2 * PACK_PRICE);

    await program.methods
      .withdraw(new anchor.BN(PACK_PRICE))
      .accounts({ config: configPda, authority: authority.publicKey })
      .rpc();

    const after = await provider.connection.getBalance(configPda);
    assert.strictEqual(before - after, PACK_PRICE);
  });

  it("rejects a purchase when the price exceeds the buyer's accepted maximum", async () => {
    await assert.rejects(
      program.methods
        .buyPack(new anchor.BN(PACK_PRICE - 1))
        .accounts({
          config: configPda,
          player: playerPda,
          pack: packPda(2),
          buyer: authority.publicKey,
        })
        .rpc(),
      /PriceExceedsMax|6001/
    );
  });

  it("rejects config changes from a non-authority wallet", async () => {
    const outsider = anchor.web3.Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      outsider.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    await assert.rejects(
      program.methods
        .setPackPrice(new anchor.BN(1))
        .accounts({ config: configPda, authority: outsider.publicKey })
        .signers([outsider])
        .rpc()
    );
  });
});
