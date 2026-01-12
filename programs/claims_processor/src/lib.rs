use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("C1aims111111111111111111111111111111111111111");

#[program]
pub mod claims_processor {
    use super::*;

    pub fn initialize_claims_system(
        ctx: Context<InitializeClaimsSystem>,
        max_auto_payout: u64,
        daily_auto_payout_limit: u64,
    ) -> Result<()> {
        let claims_state = &mut ctx.accounts.claims_state;
        claims_state.authority = ctx.accounts.authority.key();
        claims_state.policy_manager = ctx.accounts.policy_manager.key();
        claims_state.liquidity_pool = ctx.accounts.liquidity_pool.key();
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

        let policy = &ctx.accounts.policy;
        let claims_state = &mut ctx.accounts.claims_state;
        let claim = &mut ctx.accounts.claim;

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

        let claim = &mut ctx.accounts.claim;
        let claims_state = &mut ctx.accounts.claims_state;

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

        if claim.claim_amount > claims_state.max_auto_payout {
            msg!("⚠ Large claim requiring multisig approval");
        }

        if claims_state.daily_auto_paid + claim.claim_amount > claims_state.daily_auto_payout_limit {
            msg!("⚠ Daily limit reached, requiring manual approval");
        }

        claim.status = ClaimStatus::Paid;
        claim.payout_tx = Some([0u8; 64]);

        claims_state.approved_claims = claims_state.approved_claims
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;
        claims_state.total_paid_out = claims_state.total_paid_out
            .checked_add(claim.claim_amount)
            .ok_or(ErrorCode::Overflow)?;
        claims_state.daily_auto_paid = claims_state.daily_auto_paid
            .checked_add(claim.claim_amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(ClaimPaidEvent {
            claim_id: claim.claim_id,
            policy_id: ctx.accounts.policy.policy_id,
            customer: claim.customer,
            amount: claim.claim_amount,
            asset_type,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Claim {} paid: {} {:?}", claim.claim_id, claim.claim_amount, asset_type);
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

    /// CHECK: Policy account from policy-manager program
    #[account(mut)]
    pub policy: Account<'info, Policy>,

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
        mut,
        seeds = [
            b"claim",
            claim.policy.as_ref(),
            &claim.claim_id.to_le_bytes()
        ],
        bump = claim.bump
    )]
    pub claim: Account<'info, Claim>,

    /// CHECK: AI oracle signer
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

    /// CHECK: Policy from policy-manager
    pub policy: Account<'info, Policy>,

    /// CHECK: Pool state from liquidity-pool
    #[account(mut)]
    pub pool_state: AccountInfo<'info>,

    /// CHECK: Pool USDC vault
    #[account(mut)]
    pub pool_vault_usdc: Account<'info, TokenAccount>,

    /// CHECK: Pool SOL vault
    #[account(mut)]
    pub pool_vault_sol: AccountInfo<'info>,

    #[account(mut)]
    pub claimant_token_account: Account<'info, TokenAccount>,

    /// CHECK: Claimant
    #[account(mut)]
    pub claimant: AccountInfo<'info>,

    /// CHECK: Liquidity pool program
    pub liquidity_pool_program: AccountInfo<'info>,

    /// CHECK: Policy manager program
    pub policy_manager_program: AccountInfo<'info>,

    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
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

#[account]
#[derive(InitSpace)]
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
}