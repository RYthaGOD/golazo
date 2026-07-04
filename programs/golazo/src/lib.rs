//! golazo
//!
//! The on-chain half of the Golazo World Cup TCG. Buying a pack escrows the
//! pack price into the program config account and mints a `Pack` PDA that
//! commits a 32-byte seed. Card contents are derived deterministically from
//! that seed by every client, so a wallet's collection is exactly the set of
//! Pack PDAs it owns — no server, no database.
//!
//! Instruction overview:
//!   initialize     - create the global config (authority + pack price)
//!   buy_pack       - pay the pack price, mint a seed-committed Pack PDA
//!   set_pack_price - authority updates the pack price
//!   withdraw       - authority withdraws accumulated pack revenue
//!
//! Randomness note: the seed is keccak(buyer, count, slot, timestamp), which
//! is predictable enough to be devnet-grade only. A mainnet release would
//! swap this for a VRF (e.g. Switchboard) without changing the client.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;
use anchor_lang::system_program;

// Deployed devnet program id (keypair: target/deploy/golazo-keypair.json).
declare_id!("GZUkNP4HhCdqZfZdQFhruArdz5oQ4Y8mgiS9wNPWc1ZL");

#[program]
pub mod golazo {
    use super::*;

    /// Create the global config. One-time; the payer becomes the authority.
    ///
    /// NOTE: initialization is first-come-first-served — run this in the same
    /// breath as the program deploy (scripts/init-config.mjs), because whoever
    /// calls it first owns the pack revenue and price controls.
    pub fn initialize(ctx: Context<Initialize>, pack_price: u64) -> Result<()> {
        require!(pack_price > 0, GolazoError::ZeroPrice);
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.pack_price = pack_price;
        config.packs_opened = 0;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Pay the pack price and mint the buyer's next Pack PDA. The pack seed
    /// is committed on-chain; clients derive the 5 cards from it.
    ///
    /// `max_price` is the price the buyer was shown: if the authority raises
    /// the on-chain price while the buy screen is open, the purchase fails
    /// instead of silently charging more than the buyer accepted.
    pub fn buy_pack(ctx: Context<BuyPack>, max_price: u64) -> Result<()> {
        let price = ctx.accounts.config.pack_price;
        require!(price <= max_price, GolazoError::PriceExceedsMax);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.config.to_account_info(),
                },
            ),
            price,
        )?;

        let clock = Clock::get()?;
        let player = &mut ctx.accounts.player;
        let index = player.packs_bought;

        let seed = keccak::hashv(&[
            ctx.accounts.buyer.key().as_ref(),
            &index.to_le_bytes(),
            &clock.slot.to_le_bytes(),
            &clock.unix_timestamp.to_le_bytes(),
        ])
        .to_bytes();

        player.owner = ctx.accounts.buyer.key();
        player.packs_bought = index.checked_add(1).ok_or(GolazoError::MathOverflow)?;
        player.bump = ctx.bumps.player;

        let pack = &mut ctx.accounts.pack;
        pack.buyer = ctx.accounts.buyer.key();
        pack.index = index;
        pack.seed = seed;
        pack.opened_at = clock.unix_timestamp;
        pack.bump = ctx.bumps.pack;

        let config = &mut ctx.accounts.config;
        config.packs_opened = config.packs_opened.checked_add(1).ok_or(GolazoError::MathOverflow)?;

        emit!(PackBought {
            buyer: pack.buyer,
            pack: pack.key(),
            index,
            seed,
            price,
        });
        Ok(())
    }

    /// Authority-only: change the pack price.
    pub fn set_pack_price(ctx: Context<AdminConfig>, new_price: u64) -> Result<()> {
        require!(new_price > 0, GolazoError::ZeroPrice);
        ctx.accounts.config.pack_price = new_price;
        Ok(())
    }

    /// Authority-only: withdraw pack revenue, keeping the config rent-exempt.
    pub fn withdraw(ctx: Context<AdminConfig>, amount: u64) -> Result<()> {
        let config_ai = ctx.accounts.config.to_account_info();
        let rent_reserve = Rent::get()?.minimum_balance(config_ai.data_len());
        require!(
            config_ai.lamports().saturating_sub(amount) >= rent_reserve,
            GolazoError::InsufficientTreasury
        );
        **config_ai.try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += amount;
        Ok(())
    }
}

// ───────────────────────── Accounts ─────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyPack<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + PlayerState::INIT_SPACE,
        seeds = [b"player", buyer.key().as_ref()],
        bump
    )]
    pub player: Account<'info, PlayerState>,
    #[account(
        init,
        payer = buyer,
        space = 8 + Pack::INIT_SPACE,
        seeds = [b"pack", buyer.key().as_ref(), &player.packs_bought.to_le_bytes()],
        bump
    )]
    pub pack: Account<'info, Pack>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminConfig<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority @ GolazoError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

// ───────────────────────── State ─────────────────────────

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub pack_price: u64,
    pub packs_opened: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PlayerState {
    pub owner: Pubkey,
    pub packs_bought: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Pack {
    pub buyer: Pubkey,
    pub index: u64,
    pub seed: [u8; 32],
    pub opened_at: i64,
    pub bump: u8,
}

// ───────────────────────── Events & Errors ─────────────────────────

#[event]
pub struct PackBought {
    pub buyer: Pubkey,
    pub pack: Pubkey,
    pub index: u64,
    pub seed: [u8; 32],
    pub price: u64,
}

#[error_code]
pub enum GolazoError {
    #[msg("Pack price must be greater than zero")]
    ZeroPrice,
    #[msg("Pack price now exceeds the maximum the buyer accepted")]
    PriceExceedsMax,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Not enough lamports above the rent-exempt reserve")]
    InsufficientTreasury,
    #[msg("Unauthorized")]
    Unauthorized,
}
