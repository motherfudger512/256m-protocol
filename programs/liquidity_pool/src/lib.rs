use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer, MintTo, Burn};

declare_id!("LPoo1111111111111111111111111111111111111111");

#[program]
pub mod liquidity_pool {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        lp_fee_bps: u16,
    ) -> Result<()> {
        require!(lp_fee_bps <= 2000, ErrorCode::FeeTooHigh);
        
        let pool_state = &mut ctx.accounts.pool_state;
        pool_state.authority = ctx.accounts.authority.key();
        pool_state.pool_vault_usdc = ctx.accounts.pool_vault_usdc.key();
        pool_state.pool_vault_sol = ctx.accounts.pool_vault_sol.key();
        pool_state.lp_token_mint = ctx.accounts.lp_token_mint.key();
        pool_state.total_lp_supply = 0;
        pool_state.total_capital_usdc = 0;
        pool_state.total_capital_sol = 0;
        pool_state.statutory_capital_required = 0;
        pool_state.total_premiums_collected = 0;
        pool_state.total_claims_paid = 0;
        pool_state.total_interest_earned = 0;
        pool_state.last_interest_snapshot = Clock::get()?.unix_timestamp;
        pool_state.lp_fee_bps = lp_fee_bps;
        pool_state.scr_coverage_ratio = 10000;
        pool_state.bump = ctx.bumps.pool_state;

        msg!("Pool initialized with LP fee: {}bps", lp_fee_bps);
        Ok(())
    }

    pub fn deposit_lp_usdc(
        ctx: Context<DepositLPUSDC>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let pool_state = &mut ctx.accounts.pool_state;
        let lp_position = &mut ctx.accounts.lp_position;
        
        let lp_tokens_to_mint = calculate_lp_tokens_to_mint(amount, pool_state)?;
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.depositor_usdc.to_account_info(),
                to: ctx.accounts.pool_vault_usdc.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        let seeds: [&[u8]; 2] = [b"pool_state", &[pool_state.bump]];
        let signer = &[&seeds[..]];

        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.lp_token_mint.to_account_info(),
                to: ctx.accounts.depositor_lp_token.to_account_info(),
                authority: pool_state.to_account_info(),
            },
            signer,
        );
        token::mint_to(mint_ctx, lp_tokens_to_mint)?;

        pool_state.total_capital_usdc = pool_state.total_capital_usdc
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        pool_state.total_lp_supply = pool_state.total_lp_supply
            .checked_add(lp_tokens_to_mint)
            .ok_or(ErrorCode::Overflow)?;

        pool_state.scr_coverage_ratio = calculate_scr_coverage(pool_state);

        lp_position.owner = ctx.accounts.depositor.key();
        lp_position.lp_tokens = lp_position.lp_tokens
            .checked_add(lp_tokens_to_mint)
            .ok_or(ErrorCode::Overflow)?;
        lp_position.usdc_deposited = lp_position.usdc_deposited
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        lp_position.last_deposit = Clock::get()?.unix_timestamp;

        if lp_position.bump == 0 {
            lp_position.bump = ctx.bumps.lp_position;
        }

        emit!(DepositEvent {
            depositor: ctx.accounts.depositor.key(),
            amount,
            lp_tokens_minted: lp_tokens_to_mint,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Deposited {} USDC, minted {} LP tokens", amount, lp_tokens_to_mint);
        Ok(())
    }

    pub fn deposit_lp_sol(
        ctx: Context<DepositLPSOL>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let pool_state = &mut ctx.accounts.pool_state;
        let lp_position = &mut ctx.accounts.lp_position;
        
        let lp_tokens_to_mint = calculate_lp_tokens_to_mint(amount, pool_state)?;
        
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.depositor.key(),
            &ctx.accounts.pool_vault_sol.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.depositor.to_account_info(),
                ctx.accounts.pool_vault_sol.to_account_info(),
            ],
        )?;

        let seeds: [&[u8]; 2] = [b"pool_state", &[pool_state.bump]];
        let signer = &[&seeds[..]];

        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.lp_token_mint.to_account_info(),
                to: ctx.accounts.depositor_lp_token.to_account_info(),
                authority: pool_state.to_account_info(),
            },
            signer,
        );
        token::mint_to(mint_ctx, lp_tokens_to_mint)?;

        pool_state.total_capital_sol = pool_state.total_capital_sol
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        pool_state.total_lp_supply = pool_state.total_lp_supply
            .checked_add(lp_tokens_to_mint)
            .ok_or(ErrorCode::Overflow)?;

        pool_state.scr_coverage_ratio = calculate_scr_coverage(pool_state);

        lp_position.owner = ctx.accounts.depositor.key();
        lp_position.lp_tokens = lp_position.lp_tokens
            .checked_add(lp_tokens_to_mint)
            .ok_or(ErrorCode::Overflow)?;
        lp_position.sol_deposited = lp_position.sol_deposited
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        lp_position.last_deposit = Clock::get()?.unix_timestamp;

        if lp_position.bump == 0 {
            lp_position.bump = ctx.bumps.lp_position;
        }

        emit!(DepositEvent {
            depositor: ctx.accounts.depositor.key(),
            amount,
            lp_tokens_minted: lp_tokens_to_mint,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Deposited {} SOL, minted {} LP tokens", amount, lp_tokens_to_mint);
        Ok(())
    }

    pub fn withdraw_lp_usdc(
        ctx: Context<WithdrawLPUSDC>,
        lp_tokens: u64,
    ) -> Result<()> {
        require!(lp_tokens > 0, ErrorCode::InvalidAmount);
        
        let pool_state = &mut ctx.accounts.pool_state;
        let lp_position = &mut ctx.accounts.lp_position;

        require!(
            lp_position.lp_tokens >= lp_tokens,
            ErrorCode::InsufficientLPTokens
        );

        let (net_amount, fee) = calculate_withdrawal_amount(lp_tokens, pool_state)?;

        require!(
            ctx.accounts.pool_vault_usdc.amount >= net_amount,
            ErrorCode::InsufficientPoolLiquidity
        );

        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.lp_token_mint.to_account_info(),
                from: ctx.accounts.withdrawer_lp_token.to_account_info(),
                authority: ctx.accounts.withdrawer.to_account_info(),
            },
        );
        token::burn(burn_ctx, lp_tokens)?;

        let seeds: [&[u8]; 2] = [b"pool_state", &[pool_state.bump]];
        let signer = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_vault_usdc.to_account_info(),
                to: ctx.accounts.withdrawer_usdc.to_account_info(),
                authority: pool_state.to_account_info(),
            },
            signer,
        );
        token::transfer(transfer_ctx, net_amount)?;

        pool_state.total_capital_usdc = pool_state.total_capital_usdc
            .checked_sub(net_amount)
            .ok_or(ErrorCode::Underflow)?;
        pool_state.total_lp_supply = pool_state.total_lp_supply
            .checked_sub(lp_tokens)
            .ok_or(ErrorCode::Underflow)?;

        pool_state.scr_coverage_ratio = calculate_scr_coverage(pool_state);

        lp_position.lp_tokens = lp_position.lp_tokens
            .checked_sub(lp_tokens)
            .ok_or(ErrorCode::Underflow)?;
        lp_position.last_withdrawal = Clock::get()?.unix_timestamp;

        emit!(WithdrawalEvent {
            withdrawer: ctx.accounts.withdrawer.key(),
            lp_tokens_burned: lp_tokens,
            amount_received: net_amount,
            fee_retained: fee,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Withdrew {} USDC (fee: {}), burned {} LP tokens", net_amount, fee, lp_tokens);
        Ok(())
    }

    pub fn withdraw_lp_sol(
        ctx: Context<WithdrawLPSOL>,
        lp_tokens: u64,
    ) -> Result<()> {
        require!(lp_tokens > 0, ErrorCode::InvalidAmount);
        
        let pool_state = &mut ctx.accounts.pool_state;
        let lp_position = &mut ctx.accounts.lp_position;

        require!(
            lp_position.lp_tokens >= lp_tokens,
            ErrorCode::InsufficientLPTokens
        );

        let (net_amount, fee) = calculate_withdrawal_amount(lp_tokens, pool_state)?;

        require!(
            ctx.accounts.pool_vault_sol.lamports() >= net_amount,
            ErrorCode::InsufficientPoolLiquidity
        );

        let burn_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.lp_token_mint.to_account_info(),
                from: ctx.accounts.withdrawer_lp_token.to_account_info(),
                authority: ctx.accounts.withdrawer.to_account_info(),
            },
        );
        token::burn(burn_ctx, lp_tokens)?;

        **ctx.accounts.pool_vault_sol.to_account_info().try_borrow_mut_lamports()? = ctx.accounts
            .pool_vault_sol
            .to_account_info()
            .lamports()
            .checked_sub(net_amount)
            .ok_or(ErrorCode::Underflow)?;

        **ctx.accounts.withdrawer.to_account_info().try_borrow_mut_lamports()? = ctx.accounts
            .withdrawer
            .to_account_info()
            .lamports()
            .checked_add(net_amount)
            .ok_or(ErrorCode::Overflow)?;

        pool_state.total_capital_sol = pool_state.total_capital_sol
            .checked_sub(net_amount)
            .ok_or(ErrorCode::Underflow)?;
        pool_state.total_lp_supply = pool_state.total_lp_supply
            .checked_sub(lp_tokens)
            .ok_or(ErrorCode::Underflow)?;

        pool_state.scr_coverage_ratio = calculate_scr_coverage(pool_state);

        lp_position.lp_tokens = lp_position.lp_tokens
            .checked_sub(lp_tokens)
            .ok_or(ErrorCode::Underflow)?;
        lp_position.last_withdrawal = Clock::get()?.unix_timestamp;

        emit!(WithdrawalEvent {
            withdrawer: ctx.accounts.withdrawer.key(),
            lp_tokens_burned: lp_tokens,
            amount_received: net_amount,
            fee_retained: fee,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Withdrew {} SOL (fee: {}), burned {} LP tokens", net_amount, fee, lp_tokens);
        Ok(())
    }

    pub fn record_premium(
        ctx: Context<RecordPremium>,
        amount: u64,
    ) -> Result<()> {
        let pool_state = &mut ctx.accounts.pool_state;

        pool_state.total_premiums_collected = pool_state.total_premiums_collected
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        pool_state.scr_coverage_ratio = calculate_scr_coverage(pool_state);

        emit!(PremiumRecordedEvent {
            amount,
            total_premiums: pool_state.total_premiums_collected,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Recorded premium: {}", amount);
        Ok(())
    }

    pub fn execute_payout(
        ctx: Context<ExecutePayout>,
        amount: u64,
        asset_type: AssetType,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let pool_state = &mut ctx.accounts.pool_state;

        match asset_type {
            AssetType::USDC => {
                require!(
                    ctx.accounts.pool_vault_usdc.amount >= amount,
                    ErrorCode::InsufficientPoolLiquidity
                );

                let seeds: [&[u8]; 2] = [b"pool_state", &[pool_state.bump]];
                let signer = &[&seeds[..]];

                let transfer_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.pool_vault_usdc.to_account_info(),
                        to: ctx.accounts.claimant_usdc.to_account_info(),
                        authority: pool_state.to_account_info(),
                    },
                    signer,
                );
                token::transfer(transfer_ctx, amount)?;

                pool_state.total_capital_usdc = pool_state.total_capital_usdc
                    .checked_sub(amount)
                    .ok_or(ErrorCode::Underflow)?;
            }
            AssetType::SOL => {
                require!(
                    ctx.accounts.pool_vault_sol.lamports() >= amount,
                    ErrorCode::InsufficientPoolLiquidity
                );

                **ctx.accounts.pool_vault_sol.to_account_info().try_borrow_mut_lamports()? = ctx.accounts
                    .pool_vault_sol
                    .to_account_info()
                    .lamports()
                    .checked_sub(amount)
                    .ok_or(ErrorCode::Underflow)?;

                **ctx.accounts.claimant.to_account_info().try_borrow_mut_lamports()? = ctx.accounts
                    .claimant
                    .to_account_info()
                    .lamports()
                    .checked_add(amount)
                    .ok_or(ErrorCode::Overflow)?;

                pool_state.total_capital_sol = pool_state.total_capital_sol
                    .checked_sub(amount)
                    .ok_or(ErrorCode::Underflow)?;
            }
        }

        pool_state.total_claims_paid = pool_state.total_claims_paid
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        pool_state.scr_coverage_ratio = calculate_scr_coverage(pool_state);

        emit!(PayoutEvent {
            claimant: ctx.accounts.claimant.key(),
            amount,
            asset_type,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Executed payout: {} {:?}", amount, asset_type);
        Ok(())
    }

    pub fn record_interest_snapshot(
        ctx: Context<RecordInterestSnapshot>,
        epoch: u64,
        interest_rate_bps: u16,
        interest_accrued: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.pool_state.authority,
            ErrorCode::Unauthorized
        );

        let snapshot = &mut ctx.accounts.interest_snapshot;
        let pool_state = &mut ctx.accounts.pool_state;

        snapshot.epoch = epoch;
        snapshot.timestamp = Clock::get()?.unix_timestamp;
        snapshot.total_capital = pool_state.total_capital_usdc
            .checked_add(pool_state.total_capital_sol)
            .ok_or(ErrorCode::Overflow)?;
        snapshot.interest_rate_bps = interest_rate_bps;
        snapshot.interest_accrued = interest_accrued;
        snapshot.bump = ctx.bumps.interest_snapshot;

        pool_state.total_interest_earned = pool_state.total_interest_earned
            .checked_add(interest_accrued)
            .ok_or(ErrorCode::Overflow)?;
        pool_state.last_interest_snapshot = Clock::get()?.unix_timestamp;

        pool_state.scr_coverage_ratio = calculate_scr_coverage(pool_state);

        emit!(InterestSnapshotEvent {
            epoch,
            interest_accrued,
            total_interest: pool_state.total_interest_earned,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Recorded interest snapshot: epoch {}, accrued {}", epoch, interest_accrued);
        Ok(())
    }

    pub fn update_scr(
        ctx: Context<UpdateSCR>,
        new_scr: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.pool_state.authority,
            ErrorCode::Unauthorized
        );

        let pool_state = &mut ctx.accounts.pool_state;
        pool_state.statutory_capital_required = new_scr;
        pool_state.scr_coverage_ratio = calculate_scr_coverage(pool_state);

        emit!(SCRUpdateEvent {
            new_scr,
            coverage_ratio: pool_state.scr_coverage_ratio,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Updated SCR to: {}, coverage ratio: {}bps", new_scr, pool_state.scr_coverage_ratio);
        Ok(())
    }

    pub fn distribute_rewards(
        ctx: Context<DistributeRewards>,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.pool_state.authority,
            ErrorCode::Unauthorized
        );

        let pool_state = &ctx.accounts.pool_state;
        let lp_position = &mut ctx.accounts.lp_position;

        let net_profit = calculate_net_profit(pool_state)?;
        let lp_share = net_profit
            .checked_mul(10000 - pool_state.lp_fee_bps as u64)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::DivisionByZero)?;

        let lp_reward = lp_share
            .checked_mul(lp_position.lp_tokens)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(pool_state.total_lp_supply)
            .ok_or(ErrorCode::DivisionByZero)?;

        lp_position.rewards_earned = lp_position.rewards_earned
            .checked_add(lp_reward)
            .ok_or(ErrorCode::Overflow)?;

        emit!(RewardDistributionEvent {
            lp_owner: lp_position.owner,
            reward_amount: lp_reward,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Distributed {} rewards to LP", lp_reward);
        Ok(())
    }
}

fn calculate_lp_tokens_to_mint(deposit_amount: u64, pool_state: &PoolState) -> Result<u64> {
    if pool_state.total_lp_supply == 0 {
        Ok(deposit_amount)
    } else {
        let pool_value = calculate_pool_value(pool_state)?;
        
        let lp_tokens = (deposit_amount as u128)
            .checked_mul(pool_state.total_lp_supply as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(pool_value as u128)
            .ok_or(ErrorCode::DivisionByZero)?;

        Ok(lp_tokens as u64)
    }
}

fn calculate_withdrawal_amount(lp_tokens: u64, pool_state: &PoolState) -> Result<(u64, u64)> {
    let pool_value = calculate_pool_value(pool_state)?;
    
    let gross_amount = (lp_tokens as u128)
        .checked_mul(pool_value as u128)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(pool_state.total_lp_supply as u128)
        .ok_or(ErrorCode::DivisionByZero)?;

    let gross_amount = gross_amount as u64;
    
    let fee_bps = calculate_withdrawal_fee(pool_state.scr_coverage_ratio);
    let fee = gross_amount
        .checked_mul(fee_bps as u64)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(10000)
        .ok_or(ErrorCode::DivisionByZero)?;
    
    let net_amount = gross_amount
        .checked_sub(fee)
        .ok_or(ErrorCode::Underflow)?;
    
    Ok((net_amount, fee))
}

fn calculate_pool_value(pool_state: &PoolState) -> Result<u64> {
    let value = pool_state.total_capital_usdc
        .checked_add(pool_state.total_capital_sol)
        .ok_or(ErrorCode::Overflow)?
        .checked_add(pool_state.total_premiums_collected)
        .ok_or(ErrorCode::Overflow)?
        .checked_add(pool_state.total_interest_earned)
        .ok_or(ErrorCode::Overflow)?
        .checked_sub(pool_state.total_claims_paid)
        .ok_or(ErrorCode::Underflow)?;
    
    Ok(value)
}

fn calculate_scr_coverage(pool_state: &PoolState) -> u16 {
    if pool_state.statutory_capital_required == 0 {
        return 10000;
    }

    let total_capital = pool_state.total_capital_usdc
        .saturating_add(pool_state.total_capital_sol)
        .saturating_add(pool_state.total_premiums_collected)
        .saturating_add(pool_state.total_interest_earned)
        .saturating_sub(pool_state.total_claims_paid);

    let ratio = (total_capital as u128)
        .saturating_mul(10000)
        .saturating_div(pool_state.statutory_capital_required as u128);

    ratio.min(u16::MAX as u128) as u16
}

fn calculate_withdrawal_fee(coverage_ratio: u16) -> u16 {
    match coverage_ratio {
        0..=5000 => 10000,
        5001..=7000 => 5000,
        7001..=9000 => 2000,
        9001..=11000 => 500,
        11001..=13000 => 100,
        _ => 0,
    }
}

fn calculate_net_profit(pool_state: &PoolState) -> Result<u64> {
    let gross_revenue = pool_state.total_premiums_collected
        .checked_add(pool_state.total_interest_earned)
        .ok_or(ErrorCode::Overflow)?;
    
    let net_profit = gross_revenue
        .checked_sub(pool_state.total_claims_paid)
        .ok_or(ErrorCode::Underflow)?;
    
    Ok(net_profit)
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PoolState::INIT_SPACE,
        seeds = [b"pool_state"],
        bump
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = pool_state,
        seeds = [b"pool_vault_usdc"],
        bump
    )]
    pub pool_vault_usdc: Account<'info, TokenAccount>,

    /// CHECK: SOL vault PDA
    #[account(
        mut,
        seeds = [b"pool_vault_sol"],
        bump
    )]
    pub pool_vault_sol: AccountInfo<'info>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = pool_state,
        seeds = [b"lp_token_mint"],
        bump
    )]
    pub lp_token_mint: Account<'info, Mint>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DepositLPUSDC<'info> {
    #[account(
        mut,
        seeds = [b"pool_state"],
        bump = pool_state.bump
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        init_if_needed,
        payer = depositor,
        space = 8 + LPPosition::INIT_SPACE,
        seeds = [b"lp_position", depositor.key().as_ref()],
        bump
    )]
    pub lp_position: Account<'info, LPPosition>,

    #[account(
        mut,
        seeds = [b"pool_vault_usdc"],
        bump
    )]
    pub pool_vault_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"lp_token_mint"],
        bump
    )]
    pub lp_token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub depositor_usdc: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = depositor,
        associated_token::mint = lp_token_mint,
        associated_token::authority = depositor
    )]
    pub depositor_lp_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositLPSOL<'info> {
    #[account(
        mut,
        seeds = [b"pool_state"],
        bump = pool_state.bump
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        init_if_needed,
        payer = depositor,
        space = 8 + LPPosition::INIT_SPACE,
        seeds = [b"lp_position", depositor.key().as_ref()],
        bump
    )]
    pub lp_position: Account<'info, LPPosition>,

    /// CHECK: SOL vault PDA
    #[account(
        mut,
        seeds = [b"pool_vault_sol"],
        bump
    )]
    pub pool_vault_sol: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"lp_token_mint"],
        bump
    )]
    pub lp_token_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = depositor,
        associated_token::mint = lp_token_mint,
        associated_token::authority = depositor
    )]
    pub depositor_lp_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawLPUSDC<'info> {
    #[account(
        mut,
        seeds = [b"pool_state"],
        bump = pool_state.bump
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        mut,
        seeds = [b"lp_position", withdrawer.key().as_ref()],
        bump = lp_position.bump
    )]
    pub lp_position: Account<'info, LPPosition>,

    #[account(
        mut,
        seeds = [b"pool_vault_usdc"],
bump
)]
pub pool_vault_usdc: Account<'info, TokenAccount>,
#[account(
    mut,
    seeds = [b"lp_token_mint"],
    bump
)]
pub lp_token_mint: Account<'info, Mint>,

#[account(mut)]
pub withdrawer_usdc: Account<'info, TokenAccount>,

#[account(mut)]
pub withdrawer_lp_token: Account<'info, TokenAccount>,

#[account(mut)]
pub withdrawer: Signer<'info>,

pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
pub struct WithdrawLPSOL<'info> {
#[account(
mut,
seeds = [b"pool_state"],
bump = pool_state.bump
)]
pub pool_state: Account<'info, PoolState>,
#[account(
    mut,
    seeds = [b"lp_position", withdrawer.key().as_ref()],
    bump = lp_position.bump
)]
pub lp_position: Account<'info, LPPosition>,

/// CHECK: SOL vault PDA
#[account(
    mut,
    seeds = [b"pool_vault_sol"],
    bump
)]
pub pool_vault_sol: AccountInfo<'info>,

#[account(
    mut,
    seeds = [b"lp_token_mint"],
    bump
)]
pub lp_token_mint: Account<'info, Mint>,

#[account(mut)]
pub withdrawer_lp_token: Account<'info, TokenAccount>,

#[account(mut)]
pub withdrawer: Signer<'info>,

pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
pub struct RecordPremium<'info> {
#[account(
mut,
seeds = [b"pool_state"],
bump = pool_state.bump
)]
pub pool_state: Account<'info, PoolState>,
/// CHECK: Only policy-manager program can call this
pub policy_manager: Signer<'info>,
}
#[derive(Accounts)]
pub struct ExecutePayout<'info> {
#[account(
mut,
seeds = [b"pool_state"],
bump = pool_state.bump
)]
pub pool_state: Account<'info, PoolState>,
#[account(
    mut,
    seeds = [b"pool_vault_usdc"],
    bump
)]
pub pool_vault_usdc: Account<'info, TokenAccount>,

/// CHECK: SOL vault PDA
#[account(
    mut,
    seeds = [b"pool_vault_sol"],
    bump
)]
pub pool_vault_sol: AccountInfo<'info>,

#[account(mut)]
pub claimant_usdc: Account<'info, TokenAccount>,

/// CHECK: Claimant can receive SOL
#[account(mut)]
pub claimant: AccountInfo<'info>,

/// CHECK: Only claims-processor program can call this
pub claims_processor: Signer<'info>,

pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
#[instruction(epoch: u64)]
pub struct RecordInterestSnapshot<'info> {
#[account(
mut,
seeds = [b"pool_state"],
bump = pool_state.bump
)]
pub pool_state: Account<'info, PoolState>,
#[account(
    init,
    payer = authority,
    space = 8 + InterestSnapshot::INIT_SPACE,
    seeds = [b"interest_snapshot", epoch.to_le_bytes().as_ref()],
    bump
)]
pub interest_snapshot: Account<'info, InterestSnapshot>,

#[account(mut)]
pub authority: Signer<'info>,

pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct UpdateSCR<'info> {
#[account(
mut,
seeds = [b"pool_state"],
bump = pool_state.bump
)]
pub pool_state: Account<'info, PoolState>,
pub authority: Signer<'info>,
}
#[derive(Accounts)]
pub struct DistributeRewards<'info> {
#[account(
seeds = [b"pool_state"],
bump = pool_state.bump
)]
pub pool_state: Account<'info, PoolState>,
#[account(
    mut,
    seeds = [b"lp_position", lp_position.owner.as_ref()],
    bump = lp_position.bump
)]
pub lp_position: Account<'info, LPPosition>,

pub authority: Signer<'info>,
}
#[account]
#[derive(InitSpace)]
pub struct PoolState {
pub authority: Pubkey,
pub pool_vault_usdc: Pubkey,
pub pool_vault_sol: Pubkey,
pub lp_token_mint: Pubkey,
pub total_lp_supply: u64,
pub total_capital_usdc: u64,
pub total_capital_sol: u64,
pub statutory_capital_required: u64,
pub total_premiums_collected: u64,
pub total_claims_paid: u64,
pub total_interest_earned: u64,
pub last_interest_snapshot: i64,
pub lp_fee_bps: u16,
pub scr_coverage_ratio: u16,
pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct LPPosition {
pub owner: Pubkey,
pub lp_tokens: u64,
pub usdc_deposited: u64,
pub sol_deposited: u64,
pub rewards_earned: u64,
pub last_deposit: i64,
pub last_withdrawal: i64,
pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct InterestSnapshot {
pub epoch: u64,
pub timestamp: i64,
pub total_capital: u64,
pub interest_rate_bps: u16,
pub interest_accrued: u64,
pub bump: u8,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum AssetType {
USDC,
SOL,
}
#[event]
pub struct DepositEvent {
pub depositor: Pubkey,
pub amount: u64,
pub lp_tokens_minted: u64,
pub timestamp: i64,
}
#[event]
pub struct WithdrawalEvent {
pub withdrawer: Pubkey,
pub lp_tokens_burned: u64,
pub amount_received: u64,
pub fee_retained: u64,
pub timestamp: i64,
}
#[event]
pub struct PremiumRecordedEvent {
pub amount: u64,
pub total_premiums: u64,
pub timestamp: i64,
}
#[event]
pub struct PayoutEvent {
pub claimant: Pubkey,
pub amount: u64,
pub asset_type: AssetType,
pub timestamp: i64,
}
#[event]
pub struct InterestSnapshotEvent {
pub epoch: u64,
pub interest_accrued: u64,
pub total_interest: u64,
pub timestamp: i64,
}
#[event]
pub struct SCRUpdateEvent {
pub new_scr: u64,
pub coverage_ratio: u16,
pub timestamp: i64,
}
#[event]
pub struct RewardDistributionEvent {
pub lp_owner: Pubkey,
pub reward_amount: u64,
pub timestamp: i64,
}
#[error_code]
pub enum ErrorCode {
#[msg("Fee cannot exceed 20%")]
FeeTooHigh,
#[msg("Invalid amount")]
InvalidAmount,

#[msg("Insufficient LP tokens")]
InsufficientLPTokens,

#[msg("Insufficient pool liquidity")]
InsufficientPoolLiquidity,

#[msg("Arithmetic overflow")]
Overflow,

#[msg("Arithmetic underflow")]
Underflow,

#[msg("Division by zero")]
DivisionByZero,

#[msg("Unauthorized")]
Unauthorized,
}