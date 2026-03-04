use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::AccountMeta;

declare_id!("7fHLi8GsPqT4dbEjezKc4KaxWQ34kNv4vi8rwDwWxL4g");

#[program]
pub mod claims_processor {
    use super::*;

    pub fn initialize_claims_system(
        ctx: Context<InitializeClaimsSystem>,
        max_auto_payout: u64,
        daily_auto_payout_limit: u64,
        ai_oracle: Pubkey,
    ) -> Result<()> {
        let claims_state = &mut ctx.accounts.claims_state;
        claims_state.authority = ctx.accounts.authority.key();
        claims_state.policy_manager = ctx.accounts.policy_manager.key();
        claims_state.liquidity_pool = ctx.accounts.liquidity_pool.key();
        claims_state.ai_oracle = ai_oracle;
        claims_state.total_claims = 0;
        claims_state.approved_claims = 0;
        claims_state.rejected_claims = 0;
        claims_state.total_paid_out = 0;
        claims_state.max_auto_payout = max_auto_payout;
        claims_state.daily_auto_payout_limit = daily_auto_payout_limit;
        claims_state.daily_auto_paid = 0;
        claims_state.last_reset_day = Clock::get()?.unix_timestamp / 86400;
        claims_state.bump = ctx.bumps.claims_state;

        emit!(ClaimsSystemInitializedEvent {
            authority: ctx.accounts.authority.key(),
            max_auto_payout,
            daily_auto_payout_limit,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Claims system initialized");
        Ok(())
    }

    pub fn submit_claim(
        ctx: Context<SubmitClaim>,
        claim_type: ClaimType,
        documents_hash: [u8; 32],
        claimed_amount: u64,
    ) -> Result<()> {
        require!(claimed_amount > 0, ErrorCode::InvalidAmount);

        let claims_state = &mut ctx.accounts.claims_state;
        let claim = &mut ctx.accounts.claim;

        // Deserialize policy from cross-program account
        let policy = deserialize_policy(
            &ctx.accounts.policy,
            &claims_state.policy_manager,
        )?;

        require!(
            policy.status == PolicyStatus::Active,
            ErrorCode::PolicyNotActive
        );

        require!(
            policy.claim_count == 0,
            ErrorCode::PolicyAlreadyClaimed
        );

        match policy.coverage_type {
            CoverageType::TheftOnly => {
                require!(
                    claim_type == ClaimType::Theft,
                    ErrorCode::ClaimTypeNotCovered
                );
            }
            CoverageType::TheftAndLoss => {
            }
        }

        let deductible_amount = claimed_amount
            .checked_mul(policy.deductible_bps as u64)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::DivisionByZero)?;

        let payout_amount = claimed_amount
            .checked_sub(deductible_amount)
            .ok_or(ErrorCode::Underflow)?;

        require!(
            payout_amount <= policy.insured_value,
            ErrorCode::PayoutExceedsInsuredValue
        );

        let clock = Clock::get()?;
        let claim_id = claims_state.total_claims + 1;

        claim.claim_id = claim_id;
        claim.policy = ctx.accounts.policy.key();
        claim.customer = policy.customer;
        claim.claim_type = claim_type;
        claim.claim_amount = payout_amount;
        claim.documents_hash = documents_hash;
        claim.submitted_at = clock.unix_timestamp;
        claim.status = ClaimStatus::Submitted;
        claim.ai_decision = AIDecision::Pending;
        claim.ai_confidence = 0;
        claim.manual_reviewer = None;
        claim.reviewed_at = None;
        claim.payout_tx = None;
        claim.bump = ctx.bumps.claim;

        claims_state.total_claims = claim_id;

        emit!(ClaimSubmittedEvent {
            claim_id,
            policy_id: policy.policy_id,
            customer: policy.customer,
            claim_type,
            claim_amount: payout_amount,
            timestamp: clock.unix_timestamp,
        });

        msg!("Claim {} submitted for policy {}", claim_id, policy.policy_id);
        Ok(())
    }

    pub fn ai_review_claim(
        ctx: Context<AIReviewClaim>,
        decision: AIDecision,
        confidence: u8,
    ) -> Result<()> {
        require!(
            ctx.accounts.ai_oracle.key() == ctx.accounts.claims_state.ai_oracle,
            ErrorCode::UnauthorizedOracle
        );
        require!(confidence <= 100, ErrorCode::InvalidConfidence);

        let claim = &mut ctx.accounts.claim;

        require!(
            claim.status == ClaimStatus::Submitted,
            ErrorCode::InvalidClaimStatus
        );

        claim.ai_decision = decision;
        claim.ai_confidence = confidence;

        match decision {
            AIDecision::Approved => {
                if confidence >= 80 {
                    claim.status = ClaimStatus::UnderReview;
                }
            }
            AIDecision::Rejected => {
                claim.status = ClaimStatus::UnderReview;
            }
            AIDecision::ManualReview => {
                claim.status = ClaimStatus::UnderReview;
            }
            _ => {}
        }

        emit!(AIReviewCompletedEvent {
            claim_id: claim.claim_id,
            decision,
            confidence,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("AI reviewed claim {}: {:?} ({}% confidence)", claim.claim_id, decision, confidence);
        Ok(())
    }

    pub fn manual_review_claim(
        ctx: Context<ManualReviewClaim>,
        approve: bool,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.claims_state.authority,
            ErrorCode::Unauthorized
        );

        let claim = &mut ctx.accounts.claim;

        require!(
            claim.status == ClaimStatus::Submitted || claim.status == ClaimStatus::UnderReview,
            ErrorCode::InvalidClaimStatus
        );

        claim.manual_reviewer = Some(ctx.accounts.authority.key());
        claim.reviewed_at = Some(Clock::get()?.unix_timestamp);

        if approve {
            claim.status = ClaimStatus::Approved;
        } else {
            claim.status = ClaimStatus::Rejected;
            
            let claims_state = &mut ctx.accounts.claims_state;
            claims_state.rejected_claims = claims_state.rejected_claims
                .checked_add(1)
                .ok_or(ErrorCode::Overflow)?;
        }

        emit!(ManualReviewCompletedEvent {
            claim_id: claim.claim_id,
            reviewer: ctx.accounts.authority.key(),
            approved: approve,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Manual review claim {}: {}", claim.claim_id, if approve { "APPROVED" } else { "REJECTED" });
        Ok(())
    }

    pub fn execute_claim_payout(
        ctx: Context<ExecuteClaimPayout>,
        asset_type: AssetType,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.claims_state.authority,
            ErrorCode::Unauthorized
        );

        // Phase 1: Validation and daily limit management
        {
            let claims_state = &mut ctx.accounts.claims_state;
            let claim = &ctx.accounts.claim;

            require!(
                claim.status == ClaimStatus::Approved,
                ErrorCode::ClaimNotApproved
            );
            require!(
                claim.payout_tx.is_none(),
                ErrorCode::ClaimAlreadyPaid
            );

            let current_day = Clock::get()?.unix_timestamp / 86400;
            if current_day > claims_state.last_reset_day {
                claims_state.daily_auto_paid = 0;
                claims_state.last_reset_day = current_day;
            }

            require!(
                claim.claim_amount <= claims_state.max_auto_payout,
                ErrorCode::ExceedsMaxAutoPayout
            );
            require!(
                claims_state.daily_auto_paid.checked_add(claim.claim_amount)
                    .ok_or(ErrorCode::Overflow)? <= claims_state.daily_auto_payout_limit,
                ErrorCode::DailyPayoutLimitReached
            );
        }
        // Mutable borrow dropped — needed for CPI which borrows account infos

        // Phase 2: CPI to liquidity_pool::execute_payout
        let payout_amount = ctx.accounts.claim.claim_amount;
        let bump = ctx.accounts.claims_state.bump;

        // Build instruction data: [discriminator(8)] [amount(8)] [asset_type(1)]
        let disc = anchor_lang::solana_program::hash::hash(b"global:execute_payout");
        let mut ix_data = Vec::with_capacity(17);
        ix_data.extend_from_slice(&disc.to_bytes()[..8]);
        ix_data.extend_from_slice(&payout_amount.to_le_bytes());
        let asset_type_byte: u8 = match asset_type {
            AssetType::USDC => 0,
            AssetType::SOL => 1,
        };
        ix_data.push(asset_type_byte);

        let account_metas = vec![
            AccountMeta::new(ctx.accounts.pool_state.key(), false),
            AccountMeta::new(ctx.accounts.pool_vault_usdc.key(), false),
            AccountMeta::new(ctx.accounts.pool_vault_sol.key(), false),
            AccountMeta::new(ctx.accounts.claimant_token_account.key(), false),
            AccountMeta::new(ctx.accounts.claimant.key(), false),
            AccountMeta::new_readonly(ctx.accounts.claims_state.key(), true),
            AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
        ];

        let ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: ctx.accounts.liquidity_pool_program.key(),
            accounts: account_metas,
            data: ix_data,
        };

        let seeds = &[b"claims_state".as_ref(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        anchor_lang::solana_program::program::invoke_signed(
            &ix,
            &[
                ctx.accounts.pool_state.to_account_info(),
                ctx.accounts.pool_vault_usdc.to_account_info(),
                ctx.accounts.pool_vault_sol.to_account_info(),
                ctx.accounts.claimant_token_account.to_account_info(),
                ctx.accounts.claimant.to_account_info(),
                ctx.accounts.claims_state.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        // Phase 3: Update local state after successful CPI
        let policy = deserialize_policy(
            &ctx.accounts.policy,
            &ctx.accounts.claims_state.policy_manager,
        )?;

        let claim = &mut ctx.accounts.claim;
        let claims_state = &mut ctx.accounts.claims_state;

        claim.status = ClaimStatus::Paid;
        claim.payout_tx = Some([1u8; 64]); // TODO: store actual tx signature

        claims_state.approved_claims = claims_state.approved_claims
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;
        claims_state.total_paid_out = claims_state.total_paid_out
            .checked_add(payout_amount)
            .ok_or(ErrorCode::Overflow)?;
        claims_state.daily_auto_paid = claims_state.daily_auto_paid
            .checked_add(payout_amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(ClaimPaidEvent {
            claim_id: claim.claim_id,
            policy_id: policy.policy_id,
            customer: claim.customer,
            amount: payout_amount,
            asset_type,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Claim {} paid: {} {:?}", claim.claim_id, payout_amount, asset_type);
        Ok(())
    }

    pub fn reject_claim(
        ctx: Context<RejectClaim>,
        reason: String,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.claims_state.authority,
            ErrorCode::Unauthorized
        );

        let claim = &mut ctx.accounts.claim;
        let claims_state = &mut ctx.accounts.claims_state;

        require!(
            claim.status == ClaimStatus::Submitted || claim.status == ClaimStatus::UnderReview,
            ErrorCode::InvalidClaimStatus
        );

        claim.status = ClaimStatus::Rejected;
        claim.manual_reviewer = Some(ctx.accounts.authority.key());
        claim.reviewed_at = Some(Clock::get()?.unix_timestamp);

        claims_state.rejected_claims = claims_state.rejected_claims
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        emit!(ClaimRejectedEvent {
            claim_id: claim.claim_id,
            reviewer: ctx.accounts.authority.key(),
            reason,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Claim {} rejected", claim.claim_id);
        Ok(())
    }

    pub fn update_payout_limits(
        ctx: Context<UpdatePayoutLimits>,
        max_auto_payout: u64,
        daily_auto_payout_limit: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.claims_state.authority,
            ErrorCode::Unauthorized
        );

        let claims_state = &mut ctx.accounts.claims_state;
        claims_state.max_auto_payout = max_auto_payout;
        claims_state.daily_auto_payout_limit = daily_auto_payout_limit;

        emit!(PayoutLimitsUpdatedEvent {
            max_auto_payout,
            daily_auto_payout_limit,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Payout limits updated: max={}, daily={}", max_auto_payout, daily_auto_payout_limit);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeClaimsSystem<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ClaimsState::INIT_SPACE,
        seeds = [b"claims_state"],
        bump
    )]
    pub claims_state: Account<'info, ClaimsState>,

    /// CHECK: Policy manager program
    pub policy_manager: AccountInfo<'info>,

    /// CHECK: Liquidity pool program
    pub liquidity_pool: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitClaim<'info> {
    #[account(
        mut,
        seeds = [b"claims_state"],
        bump = claims_state.bump
    )]
    pub claims_state: Account<'info, ClaimsState>,

    /// CHECK: Policy account from policy-manager program, validated in handler
    pub policy: AccountInfo<'info>,

    #[account(
        init,
        payer = customer,
        space = 8 + Claim::INIT_SPACE,
        seeds = [
            b"claim",
            policy.key().as_ref(),
            &(claims_state.total_claims + 1).to_le_bytes()
        ],
        bump
    )]
    pub claim: Account<'info, Claim>,

    #[account(mut)]
    pub customer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AIReviewClaim<'info> {
    #[account(
        seeds = [b"claims_state"],
        bump = claims_state.bump
    )]
    pub claims_state: Account<'info, ClaimsState>,

    #[account(
        mut,
        seeds = [
            b"claim",
            claim.policy.as_ref(),
            &claim.claim_id.to_le_bytes()
        ],
        bump = claim.bump
    )]
    pub claim: Account<'info, Claim>,

    pub ai_oracle: Signer<'info>,
}

#[derive(Accounts)]
pub struct ManualReviewClaim<'info> {
    #[account(
        seeds = [b"claims_state"],
        bump = claims_state.bump
    )]
    pub claims_state: Account<'info, ClaimsState>,

    #[account(
        mut,
        seeds = [
            b"claim",
            claim.policy.as_ref(),
            &claim.claim_id.to_le_bytes()
        ],
        bump = claim.bump
    )]
    pub claim: Account<'info, Claim>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteClaimPayout<'info> {
    #[account(
        mut,
        seeds = [b"claims_state"],
        bump = claims_state.bump
    )]
    pub claims_state: Account<'info, ClaimsState>,

    #[account(
        mut,
        seeds = [
            b"claim",
            claim.policy.as_ref(),
            &claim.claim_id.to_le_bytes()
        ],
        bump = claim.bump
    )]
    pub claim: Account<'info, Claim>,

    /// CHECK: Policy account from policy-manager, validated in handler
    pub policy: AccountInfo<'info>,

    /// CHECK: Pool state PDA, validated by liquidity_pool program
    #[account(mut)]
    pub pool_state: AccountInfo<'info>,

    /// CHECK: Pool USDC vault, validated by liquidity_pool program
    #[account(mut)]
    pub pool_vault_usdc: AccountInfo<'info>,

    /// CHECK: Pool SOL vault, validated by liquidity_pool program
    #[account(mut)]
    pub pool_vault_sol: AccountInfo<'info>,

    /// CHECK: Claimant USDC token account, validated by liquidity_pool program
    #[account(mut)]
    pub claimant_token_account: AccountInfo<'info>,

    /// CHECK: Claimant SOL account
    #[account(mut)]
    pub claimant: AccountInfo<'info>,

    /// CHECK: Liquidity pool program
    pub liquidity_pool_program: AccountInfo<'info>,

    pub authority: Signer<'info>,

    /// CHECK: Token program, passed to liquidity_pool CPI
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct RejectClaim<'info> {
    #[account(
        mut,
        seeds = [b"claims_state"],
        bump = claims_state.bump
    )]
    pub claims_state: Account<'info, ClaimsState>,

    #[account(
        mut,
        seeds = [
            b"claim",
            claim.policy.as_ref(),
            &claim.claim_id.to_le_bytes()
        ],
        bump = claim.bump
    )]
    pub claim: Account<'info, Claim>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdatePayoutLimits<'info> {
    #[account(
        mut,
        seeds = [b"claims_state"],
        bump = claims_state.bump
    )]
    pub claims_state: Account<'info, ClaimsState>,

    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct ClaimsState {
    pub authority: Pubkey,
    pub policy_manager: Pubkey,
    pub liquidity_pool: Pubkey,
    pub ai_oracle: Pubkey,
    pub total_claims: u64,
    pub approved_claims: u64,
    pub rejected_claims: u64,
    pub total_paid_out: u64,
    pub max_auto_payout: u64,
    pub daily_auto_payout_limit: u64,
    pub daily_auto_paid: u64,
    pub last_reset_day: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Claim {
    pub claim_id: u64,
    pub policy: Pubkey,
    pub customer: Pubkey,
    pub claim_type: ClaimType,
    pub claim_amount: u64,
    pub documents_hash: [u8; 32],
    pub submitted_at: i64,
    pub status: ClaimStatus,
    pub ai_decision: AIDecision,
    pub ai_confidence: u8,
    pub manual_reviewer: Option<Pubkey>,
    pub reviewed_at: Option<i64>,
    pub payout_tx: Option<[u8; 64]>,
    pub bump: u8,
}

// Cross-program account layout matching policy_manager::Policy
// Used for manual deserialization of accounts owned by the policy_manager program
#[derive(AnchorDeserialize)]
pub struct Policy {
    pub policy_id: u64,
    pub customer: Pubkey,
    pub coverage_type: CoverageType,
    pub watch_details_hash: [u8; 32],
    pub insured_value: u64,
    pub premium: u64,
    pub deductible_bps: u16,
    pub payment_frequency: PaymentFrequency,
    pub start_date: i64,
    pub expiry_date: i64,
    pub status: PolicyStatus,
    pub total_paid: u64,
    pub next_payment_due: i64,
    pub claim_count: u8,
    pub bump: u8,
}

fn deserialize_policy(policy_info: &AccountInfo, expected_owner: &Pubkey) -> Result<Policy> {
    require!(
        *policy_info.owner == *expected_owner,
        ErrorCode::InvalidPolicyOwner
    );
    let data = policy_info.try_borrow_data()?;
    require!(data.len() > 8, ErrorCode::InvalidPolicyData);
    // Skip 8-byte Anchor discriminator
    let mut slice: &[u8] = &data[8..];
    Policy::deserialize(&mut slice)
        .map_err(|_| error!(ErrorCode::InvalidPolicyData))
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub enum ClaimType {
    Theft,
    Loss,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub enum ClaimStatus {
    Submitted,
    UnderReview,
    Approved,
    Rejected,
    Paid,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub enum AIDecision {
    Pending,
    Approved,
    Rejected,
    ManualReview,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub enum AssetType {
    USDC,
    SOL,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub enum CoverageType {
    TheftOnly,
    TheftAndLoss,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub enum PaymentFrequency {
    Monthly,
    Annual,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub enum PolicyStatus {
    Active,
    Expired,
    Claimed,
    Cancelled,
    Suspended,
}

#[event]
pub struct ClaimsSystemInitializedEvent {
    pub authority: Pubkey,
    pub max_auto_payout: u64,
    pub daily_auto_payout_limit: u64,
    pub timestamp: i64,
}

#[event]
pub struct ClaimSubmittedEvent {
    pub claim_id: u64,
    pub policy_id: u64,
    pub customer: Pubkey,
    pub claim_type: ClaimType,
    pub claim_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct AIReviewCompletedEvent {
    pub claim_id: u64,
    pub decision: AIDecision,
    pub confidence: u8,
    pub timestamp: i64,
}

#[event]
pub struct ManualReviewCompletedEvent {
    pub claim_id: u64,
    pub reviewer: Pubkey,
    pub approved: bool,
    pub timestamp: i64,
}

#[event]
pub struct ClaimPaidEvent {
    pub claim_id: u64,
    pub policy_id: u64,
    pub customer: Pubkey,
    pub amount: u64,
    pub asset_type: AssetType,
    pub timestamp: i64,
}

#[event]
pub struct ClaimRejectedEvent {
    pub claim_id: u64,
    pub reviewer: Pubkey,
    pub reason: String,
    pub timestamp: i64,
}

#[event]
pub struct PayoutLimitsUpdatedEvent {
    pub max_auto_payout: u64,
    pub daily_auto_payout_limit: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Policy is not active")]
    PolicyNotActive,

    #[msg("Policy has already been claimed")]
    PolicyAlreadyClaimed,

    #[msg("Claim type not covered by policy")]
    ClaimTypeNotCovered,

    #[msg("Payout exceeds insured value")]
    PayoutExceedsInsuredValue,

    #[msg("Invalid confidence score")]
    InvalidConfidence,

    #[msg("Invalid claim status for this operation")]
    InvalidClaimStatus,

    #[msg("Claim not approved")]
    ClaimNotApproved,

    #[msg("Claim already paid")]
    ClaimAlreadyPaid,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Arithmetic underflow")]
    Underflow,

    #[msg("Division by zero")]
    DivisionByZero,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Claim exceeds max auto-payout limit")]
    ExceedsMaxAutoPayout,

    #[msg("Daily auto-payout limit reached")]
    DailyPayoutLimitReached,

    #[msg("Insufficient pool liquidity")]
    InsufficientPoolLiquidity,

    #[msg("Unauthorized oracle")]
    UnauthorizedOracle,

    #[msg("Policy has expired")]
    PolicyExpired,

    #[msg("Invalid policy account owner")]
    InvalidPolicyOwner,

    #[msg("Failed to deserialize policy data")]
    InvalidPolicyData,
}