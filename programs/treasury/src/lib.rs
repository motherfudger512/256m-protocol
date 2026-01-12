use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Trea5ury1111111111111111111111111111111111111");

#[program]
pub mod treasury {
    use super::*;

    pub fn initialize_treasury(
        ctx: Context<InitializeTreasury>,
        withdrawal_threshold: u64,
    ) -> Result<()> {
        let treasury_state = &mut ctx.accounts.treasury_state;
        treasury_state.authority = ctx.accounts.authority.key();
        treasury_state.vault_usdc = ctx.accounts.vault_usdc.key();
        treasury_state.vault_sol = ctx.accounts.vault_sol.key();
        treasury_state.total_fees_collected = 0;
        treasury_state.platform_fees = 0;
        treasury_state.lp_service_fees = 0;
        treasury_state.total_withdrawn = 0;
        treasury_state.withdrawal_threshold = withdrawal_threshold;
        treasury_state.bump = ctx.bumps.treasury_state;

        emit!(TreasuryInitializedEvent {
            authority: ctx.accounts.authority.key(),
            withdrawal_threshold,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Treasury initialized with withdrawal threshold: {}", withdrawal_threshold);
        Ok(())
    }

    pub fn collect_platform_fee(
        ctx: Context<CollectPlatformFee>,
        amount: u64,
        asset_type: AssetType,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let treasury_state = &mut ctx.accounts.treasury_state;

        // Transfer fee to treasury vault
        match asset_type {
            AssetType::USDC => {
                let transfer_ctx = CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.source_token_account.to_account_info(),
                        to: ctx.accounts.vault_usdc.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                );
                token::transfer(transfer_ctx, amount)?;
            }
            AssetType::SOL => {
                // Transfer SOL from payer to vault
                let ix = anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.payer.key(),
                    &ctx.accounts.vault_sol.key(),
                    amount,
                );
                anchor_lang::solana_program::program::invoke(
                    &ix,
                    &[
                        ctx.accounts.payer.to_account_info(),
                        ctx.accounts.vault_sol.to_account_info(),
                    ],
                )?;
            }
        }

        // Update treasury state
        treasury_state.platform_fees = treasury_state.platform_fees
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        treasury_state.total_fees_collected = treasury_state.total_fees_collected
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(PlatformFeeCollectedEvent {
            amount,
            asset_type,
            total_collected: treasury_state.total_fees_collected,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Platform fee collected: {} {:?}", amount, asset_type);
        Ok(())
    }

    pub fn collect_lp_service_fee(
        ctx: Context<CollectLPServiceFee>,
        amount: u64,
        asset_type: AssetType,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let treasury_state = &mut ctx.accounts.treasury_state;

        // This would typically be called via CPI from liquidity pool
        // For now, we accept direct transfers

        match asset_type {
            AssetType::USDC => {
                let transfer_ctx = CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.source_token_account.to_account_info(),
                        to: ctx.accounts.vault_usdc.to_account_info(),
                        authority: ctx.accounts.pool_authority.to_account_info(),
                    },
                );
                token::transfer(transfer_ctx, amount)?;
            }
            AssetType::SOL => {
                let ix = anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.pool_authority.key(),
                    &ctx.accounts.vault_sol.key(),
                    amount,
                );
                anchor_lang::solana_program::program::invoke(
                    &ix,
                    &[
                        ctx.accounts.pool_authority.to_account_info(),
                        ctx.accounts.vault_sol.to_account_info(),
                    ],
                )?;
            }
        }

        treasury_state.lp_service_fees = treasury_state.lp_service_fees
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        treasury_state.total_fees_collected = treasury_state.total_fees_collected
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(LPServiceFeeCollectedEvent {
            amount,
            asset_type,
            total_collected: treasury_state.total_fees_collected,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("LP service fee collected: {} {:?}", amount, asset_type);
        Ok(())
    }

    pub fn withdraw_usdc(
        ctx: Context<WithdrawUSDC>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(
            ctx.accounts.authority.key() == ctx.accounts.treasury_state.authority,
            ErrorCode::Unauthorized
        );

        let treasury_state = &mut ctx.accounts.treasury_state;

        // Check available balance
        let available = ctx.accounts.vault_usdc.amount;
        require!(available >= amount, ErrorCode::InsufficientFunds);

        // Optional: Require minimum threshold before withdrawal
        if treasury_state.withdrawal_threshold > 0 {
            require!(
                available >= treasury_state.withdrawal_threshold,
                ErrorCode::BelowWithdrawalThreshold
            );
        }

        // Transfer USDC from vault to destination
        let seeds: [&[u8]; 2] = [b"treasury_state", &[treasury_state.bump]];
        let signer = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_usdc.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: treasury_state.to_account_info(),
            },
            signer,
        );
        token::transfer(transfer_ctx, amount)?;

        // Update state
        treasury_state.total_withdrawn = treasury_state.total_withdrawn
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(WithdrawalEvent {
            amount,
            asset_type: AssetType::USDC,
            destination: ctx.accounts.destination.key(),
            total_withdrawn: treasury_state.total_withdrawn,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Withdrew {} USDC to {}", amount, ctx.accounts.destination.key());
        Ok(())
    }

    pub fn withdraw_sol(
        ctx: Context<WithdrawSOL>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(
            ctx.accounts.authority.key() == ctx.accounts.treasury_state.authority,
            ErrorCode::Unauthorized
        );

        let treasury_state = &mut ctx.accounts.treasury_state;

        // Check available balance
        let available = ctx.accounts.vault_sol.lamports();
        require!(available >= amount, ErrorCode::InsufficientFunds);

        // Optional: Require minimum threshold before withdrawal
        if treasury_state.withdrawal_threshold > 0 {
            require!(
                available >= treasury_state.withdrawal_threshold,
                ErrorCode::BelowWithdrawalThreshold
            );
        }

        // Transfer SOL from vault to destination
        **ctx.accounts.vault_sol.to_account_info().try_borrow_mut_lamports()? = ctx.accounts
            .vault_sol
            .to_account_info()
            .lamports()
            .checked_sub(amount)
            .ok_or(ErrorCode::Underflow)?;

        **ctx.accounts.destination.to_account_info().try_borrow_mut_lamports()? = ctx.accounts
            .destination
            .to_account_info()
            .lamports()
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        // Update state
        treasury_state.total_withdrawn = treasury_state.total_withdrawn
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(WithdrawalEvent {
            amount,
            asset_type: AssetType::SOL,
            destination: ctx.accounts.destination.key(),
            total_withdrawn: treasury_state.total_withdrawn,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Withdrew {} SOL to {}", amount, ctx.accounts.destination.key());
        Ok(())
    }

    pub fn update_withdrawal_threshold(
        ctx: Context<UpdateWithdrawalThreshold>,
        new_threshold: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.treasury_state.authority,
            ErrorCode::Unauthorized
        );

        let treasury_state = &mut ctx.accounts.treasury_state;
        let old_threshold = treasury_state.withdrawal_threshold;
        treasury_state.withdrawal_threshold = new_threshold;

        emit!(WithdrawalThresholdUpdatedEvent {
            old_threshold,
            new_threshold,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Withdrawal threshold updated: {} -> {}", old_threshold, new_threshold);
        Ok(())
    }

    pub fn update_authority(
        ctx: Context<UpdateAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.treasury_state.authority,
            ErrorCode::Unauthorized
        );

        let treasury_state = &mut ctx.accounts.treasury_state;
        let old_authority = treasury_state.authority;
        treasury_state.authority = new_authority;

        emit!(AuthorityUpdatedEvent {
            old_authority,
            new_authority,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Authority updated: {} -> {}", old_authority, new_authority);
        Ok(())
    }

    pub fn get_treasury_stats(
        ctx: Context<GetTreasuryStats>,
    ) -> Result<TreasuryStats> {
        let treasury_state = &ctx.accounts.treasury_state;
        let vault_usdc_balance = ctx.accounts.vault_usdc.amount;
        let vault_sol_balance = ctx.accounts.vault_sol.lamports();

        Ok(TreasuryStats {
            total_fees_collected: treasury_state.total_fees_collected,
            platform_fees: treasury_state.platform_fees,
            lp_service_fees: treasury_state.lp_service_fees,
            total_withdrawn: treasury_state.total_withdrawn,
            vault_usdc_balance,
            vault_sol_balance,
            net_balance: treasury_state.total_fees_collected
                .saturating_sub(treasury_state.total_withdrawn),
        })
    }
}

// ========== CONTEXTS ==========

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TreasuryState::INIT_SPACE,
        seeds = [b"treasury_state"],
        bump
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = treasury_state,
        seeds = [b"vault_usdc"],
        bump
    )]
    pub vault_usdc: Account<'info, TokenAccount>,

    /// CHECK: SOL vault PDA
    #[account(
        mut,
        seeds = [b"vault_sol"],
        bump
    )]
    pub vault_sol: AccountInfo<'info>,

    pub usdc_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CollectPlatformFee<'info> {
    #[account(
        mut,
        seeds = [b"treasury_state"],
        bump = treasury_state.bump
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    #[account(
        mut,
        seeds = [b"vault_usdc"],
        bump
    )]
    pub vault_usdc: Account<'info, TokenAccount>,

    /// CHECK: SOL vault
    #[account(
        mut,
        seeds = [b"vault_sol"],
        bump
    )]
    pub vault_sol: AccountInfo<'info>,

    #[account(mut)]
    pub source_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CollectLPServiceFee<'info> {
    #[account(
        mut,
        seeds = [b"treasury_state"],
        bump = treasury_state.bump
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    #[account(
        mut,
        seeds = [b"vault_usdc"],
        bump
    )]
    pub vault_usdc: Account<'info, TokenAccount>,

    /// CHECK: SOL vault
    #[account(
        mut,
        seeds = [b"vault_sol"],
        bump
    )]
    pub vault_sol: AccountInfo<'info>,

    #[account(mut)]
    pub source_token_account: Account<'info, TokenAccount>,

    /// CHECK: Pool authority (would be PDA in production)
    pub pool_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawUSDC<'info> {
    #[account(
        mut,
        seeds = [b"treasury_state"],
        bump = treasury_state.bump
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    #[account(
        mut,
        seeds = [b"vault_usdc"],
        bump
    )]
    pub vault_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawSOL<'info> {
    #[account(
        mut,
        seeds = [b"treasury_state"],
        bump = treasury_state.bump
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    /// CHECK: SOL vault
    #[account(
        mut,
        seeds = [b"vault_sol"],
        bump
    )]
    pub vault_sol: AccountInfo<'info>,

    /// CHECK: Destination for SOL
    #[account(mut)]
    pub destination: AccountInfo<'info>,

    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateWithdrawalThreshold<'info> {
    #[account(
        mut,
        seeds = [b"treasury_state"],
        bump = treasury_state.bump
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        seeds = [b"treasury_state"],
        bump = treasury_state.bump
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetTreasuryStats<'info> {
    #[account(
        seeds = [b"treasury_state"],
        bump = treasury_state.bump
    )]
    pub treasury_state: Account<'info, TreasuryState>,

    #[account(
        seeds = [b"vault_usdc"],
        bump
    )]
    pub vault_usdc: Account<'info, TokenAccount>,

    /// CHECK: SOL vault
    #[account(
        seeds = [b"vault_sol"],
        bump
    )]
    pub vault_sol: AccountInfo<'info>,
}

// ========== ACCOUNT STRUCTS ==========

#[account]
#[derive(InitSpace)]
pub struct TreasuryState {
    pub authority: Pubkey,
    pub vault_usdc: Pubkey,
    pub vault_sol: Pubkey,
    pub total_fees_collected: u64,
    pub platform_fees: u64,
    pub lp_service_fees: u64,
    pub total_withdrawn: u64,
    pub withdrawal_threshold: u64,
    pub bump: u8,
}

// ========== ENUMS ==========

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum AssetType {
    USDC,
    SOL,
}

// ========== RETURN TYPES ==========

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TreasuryStats {
    pub total_fees_collected: u64,
    pub platform_fees: u64,
    pub lp_service_fees: u64,
    pub total_withdrawn: u64,
    pub vault_usdc_balance: u64,
    pub vault_sol_balance: u64,
    pub net_balance: u64,
}

// ========== EVENTS ==========

#[event]
pub struct TreasuryInitializedEvent {
    pub authority: Pubkey,
    pub withdrawal_threshold: u64,
    pub timestamp: i64,
}

#[event]
pub struct PlatformFeeCollectedEvent {
    pub amount: u64,
    pub asset_type: AssetType,
    pub total_collected: u64,
    pub timestamp: i64,
}

#[event]
pub struct LPServiceFeeCollectedEvent {
    pub amount: u64,
    pub asset_type: AssetType,
    pub total_collected: u64,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawalEvent {
    pub amount: u64,
    pub asset_type: AssetType,
    pub destination: Pubkey,
    pub total_withdrawn: u64,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawalThresholdUpdatedEvent {
    pub old_threshold: u64,
    pub new_threshold: u64,
    pub timestamp: i64,
}

#[event]
pub struct AuthorityUpdatedEvent {
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

// ========== ERRORS ==========

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Insufficient funds in treasury")]
    InsufficientFunds,

    #[msg("Below minimum withdrawal threshold")]
    BelowWithdrawalThreshold,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Arithmetic underflow")]
    Underflow,

    #[msg("Unauthorized")]
    Unauthorized,
}