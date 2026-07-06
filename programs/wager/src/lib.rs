//! wager
//!
//! PvP staked battles for Golazo. Two players each stake the same amount into
//! a match; the winner is decided ON-CHAIN by a power-weighted random roll and
//! takes the whole pot. The 5v5 match the players see in the browser is a
//! visualization seeded to agree with this verdict — the money outcome is the
//! on-chain roll, so neither client can cheat the payout.
//!
//!   create_match - open a challenge: escrow a stake, commit your squad power
//!   join_match   - accept a challenge: escrow the same stake; the program
//!                  rolls the winner and pays the pot immediately
//!   cancel_match - creator reclaims the stake while still unmatched
//!
//! Randomness note: the roll seed is keccak(creator, opponent, powers, slot,
//! timestamp) — devnet-grade (a mainnet build would use a VRF/commit-reveal).
//! A joiner cannot reliably pre-compute the result because they cannot control
//! which slot their transaction lands in.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;
use anchor_lang::system_program;

declare_id!("6qcrzBMCSNLeQK9y6xsMYEeNYMsKYbLmqbnNpkRZaogH");

const SQUAD_MAX: usize = 160; // comma-joined card ids, both squads

#[program]
pub mod wager {
    use super::*;

    /// Open a challenge. `nonce` makes the match address unique per creator so
    /// a wallet can run several at once. `power` is the squad's strength (sum
    /// of the five card overalls) and `squad` the comma-joined card ids (for
    /// the opponent to see and for replaying the match).
    pub fn create_match(
        ctx: Context<CreateMatch>,
        nonce: u64,
        stake: u64,
        power: u16,
        squad: String,
    ) -> Result<()> {
        require!(stake > 0, WagerError::ZeroStake);
        require!(power > 0, WagerError::BadPower);
        require!(squad.len() <= SQUAD_MAX, WagerError::SquadTooLong);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.match_account.to_account_info(),
                },
            ),
            stake,
        )?;

        let clock = Clock::get()?;
        let m = &mut ctx.accounts.match_account;
        m.creator = ctx.accounts.creator.key();
        m.opponent = Pubkey::default();
        m.winner = Pubkey::default();
        m.stake = stake;
        m.created_at = clock.unix_timestamp;
        m.nonce = nonce;
        m.seed = [0u8; 32];
        m.creator_power = power;
        m.opponent_power = 0;
        m.state = MatchState::Open as u8;
        m.bump = ctx.bumps.match_account;
        m.creator_squad = squad;
        m.opponent_squad = String::new();

        emit!(MatchCreated { match_key: m.key(), creator: m.creator, stake, power });
        Ok(())
    }

    /// Accept an open challenge, escrow the same stake, roll the winner on
    /// chain, and pay the pot to the winner.
    pub fn join_match(ctx: Context<JoinMatch>, power: u16, squad: String) -> Result<()> {
        require!(power > 0, WagerError::BadPower);
        require!(squad.len() <= SQUAD_MAX, WagerError::SquadTooLong);
        {
            let m = &ctx.accounts.match_account;
            require!(m.state == MatchState::Open as u8, WagerError::NotOpen);
            require!(m.creator != ctx.accounts.opponent.key(), WagerError::SelfPlay);
        }

        let stake = ctx.accounts.match_account.stake;
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.opponent.to_account_info(),
                    to: ctx.accounts.match_account.to_account_info(),
                },
            ),
            stake,
        )?;

        let clock = Clock::get()?;
        let creator = ctx.accounts.match_account.creator;
        let opponent = ctx.accounts.opponent.key();
        let cp = ctx.accounts.match_account.creator_power as u64;
        let op = power as u64;

        // Power-weighted roll: P(creator) = cp^2 / (cp^2 + op^2).
        let seed = keccak::hashv(&[
            creator.as_ref(),
            opponent.as_ref(),
            &cp.to_le_bytes(),
            &op.to_le_bytes(),
            &clock.slot.to_le_bytes(),
            &clock.unix_timestamp.to_le_bytes(),
        ])
        .to_bytes();
        let cw = cp.saturating_mul(cp);
        let ow = op.saturating_mul(op);
        let total = cw.checked_add(ow).ok_or(WagerError::MathOverflow)?;
        let roll = u64::from_le_bytes(seed[0..8].try_into().unwrap()) % total;
        let creator_wins = roll < cw;
        let winner = if creator_wins { creator } else { opponent };

        // Pay the pot (both stakes) to the winner. The match account is
        // program-owned, so lamports move directly; the rent reserve stays.
        let pot = stake.checked_mul(2).ok_or(WagerError::MathOverflow)?;
        let winner_ai = if creator_wins {
            ctx.accounts.creator.to_account_info()
        } else {
            ctx.accounts.opponent.to_account_info()
        };
        require_keys_eq!(winner_ai.key(), winner, WagerError::WinnerMismatch);

        let m_ai = ctx.accounts.match_account.to_account_info();
        **m_ai.try_borrow_mut_lamports()? -= pot;
        **winner_ai.try_borrow_mut_lamports()? += pot;

        let m = &mut ctx.accounts.match_account;
        m.opponent = opponent;
        m.opponent_power = power;
        m.opponent_squad = squad;
        m.seed = seed;
        m.winner = winner;
        m.state = MatchState::Resolved as u8;

        emit!(MatchResolved { match_key: m.key(), creator, opponent, winner, pot, seed });
        Ok(())
    }

    /// Creator reclaims their stake while the match is still unmatched. Closes
    /// the account, returning the stake + rent to the creator.
    pub fn cancel_match(ctx: Context<CancelMatch>) -> Result<()> {
        require!(
            ctx.accounts.match_account.state == MatchState::Open as u8,
            WagerError::NotOpen
        );
        Ok(())
    }
}

// ───────────────────────── Accounts ─────────────────────────

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct CreateMatch<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Match::INIT_SPACE,
        seeds = [b"match", creator.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub match_account: Account<'info, Match>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinMatch<'info> {
    #[account(
        mut,
        seeds = [b"match", match_account.creator.as_ref(), &match_account.nonce.to_le_bytes()],
        bump = match_account.bump,
    )]
    pub match_account: Account<'info, Match>,
    /// CHECK: paid the pot only when they are the winner; key is compared to
    /// the stored creator inside the handler.
    #[account(mut, address = match_account.creator @ WagerError::CreatorMismatch)]
    pub creator: UncheckedAccount<'info>,
    #[account(mut)]
    pub opponent: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelMatch<'info> {
    #[account(
        mut,
        close = creator,
        seeds = [b"match", creator.key().as_ref(), &match_account.nonce.to_le_bytes()],
        bump = match_account.bump,
        has_one = creator @ WagerError::CreatorMismatch,
    )]
    pub match_account: Account<'info, Match>,
    #[account(mut)]
    pub creator: Signer<'info>,
}

// ───────────────────────── State ─────────────────────────

#[repr(u8)]
pub enum MatchState {
    Open = 0,
    Resolved = 1,
}

#[account]
#[derive(InitSpace)]
pub struct Match {
    pub creator: Pubkey,
    pub opponent: Pubkey,
    pub winner: Pubkey,
    pub stake: u64,
    pub created_at: i64,
    pub nonce: u64,
    pub seed: [u8; 32],
    pub creator_power: u16,
    pub opponent_power: u16,
    pub state: u8,
    pub bump: u8,
    #[max_len(160)]
    pub creator_squad: String,
    #[max_len(160)]
    pub opponent_squad: String,
}

// ───────────────────────── Events & Errors ─────────────────────────

#[event]
pub struct MatchCreated {
    pub match_key: Pubkey,
    pub creator: Pubkey,
    pub stake: u64,
    pub power: u16,
}

#[event]
pub struct MatchResolved {
    pub match_key: Pubkey,
    pub creator: Pubkey,
    pub opponent: Pubkey,
    pub winner: Pubkey,
    pub pot: u64,
    pub seed: [u8; 32],
}

#[error_code]
pub enum WagerError {
    #[msg("Stake must be greater than zero")]
    ZeroStake,
    #[msg("Squad power must be greater than zero")]
    BadPower,
    #[msg("Squad string is too long")]
    SquadTooLong,
    #[msg("Match is not open")]
    NotOpen,
    #[msg("Cannot join your own match")]
    SelfPlay,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Creator account does not match the stored creator")]
    CreatorMismatch,
    #[msg("Resolved winner does not match the paid account")]
    WinnerMismatch,
}
