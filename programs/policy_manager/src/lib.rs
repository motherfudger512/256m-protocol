use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Po1icy11111111111111111111111111111111111111");

#[program]
pub mod policy_manager {
    use super::*;

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        platform_fee_bps: u16,
        max_policies: u64,
        max_insured_value: u64,
    ) -> Result<()> {
        require!(platform_fee_bps <= 2000, ErrorCode::FeeTooHigh);
        require!(max_policies <= 5000, ErrorCode::ExceedsRegulationLimit);
        require!(max_insured_value <= 30_000_000_000, ErrorCode::ExceedsRegulationLimit);

        let protocol_state = &mut ctx.accounts.protocol_state;
        protocol_state.authority = ctx.accounts.authority.key();
        protocol_state.treasury = ctx.accounts.treasury.key();
        protocol_state.liquidity_pool = ctx.accounts.liquidity_pool.key();
        protocol_state.platform_fee_bps = platform_fee_bps;
        protocol_state.total_policies = 0;
        protocol_state.active_policies = 0;
        protocol_state.max_policies = max_policies;
        protocol_state.max_insured_value = max_insured_value;
        protocol_state.total_premiums_collected = 0;
        protocol_state.bump = ctx.bumps.protocol_state;

        emit!(ProtocolInitializedEvent {
            authority: ctx.accounts.authority.key(),
            platform_fee_bps,
            max_policies,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Protocol initialized with platform fee: {}bps", platform_fee_bps);
        Ok(())
    }

    pub fn register_customer(
        ctx: Context<RegisterCustomer>,
        kyc_hash: [u8; 32],
    ) -> Result<()> {
        let customer = &mut ctx.accounts.customer;
        customer.owner = ctx.accounts.owner.key();
        customer.kyc_hash = kyc_hash;
        customer.kyc_verified = false;
        customer.kyc_verified_at = 0;
        customer.policies = Vec::new();
        customer.total_claims = 0;
        customer.fraud_flags = 0;
        customer.created_at = Clock::get()?.unix_timestamp;
        customer.bump = ctx.bumps.customer;

        emit!(CustomerRegisteredEvent {
            customer: ctx.accounts.owner.key(),
            kyc_hash,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Customer registered: {}", ctx.accounts.owner.key());
        Ok(())
    }

    pub fn verify_customer(
        ctx: Context<VerifyCustomer>,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.protocol_state.authority,
            ErrorCode::Unauthorized
        );

        let customer = &mut ctx.accounts.customer;
        customer.kyc_verified = true;
        customer.kyc_verified_at = Clock::get()?.unix_timestamp;

        emit!(CustomerVerifiedEvent {
            customer: customer.owner,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Customer KYC verified: {}", customer.owner);
        Ok(())
    }

    pub fn create_policy(
        ctx: Context<CreatePolicy>,
        watch_details_hash: [u8; 32],
        insured_value: u64,
        premium: u64,
        deductible_bps: u16,
        coverage_type: CoverageType,
        payment_frequency: PaymentFrequency,
        duration_days: u32,
    ) -> Result<()> {
        let protocol_state = &mut ctx.accounts.protocol_state;
        let customer = &mut ctx.accounts.customer;
        let policy = &mut ctx.accounts.policy;

        require!(customer.kyc_verified, ErrorCode::KYCNotVerified);
        require!(
            protocol_state.total_policies < protocol_state.max_policies,
            ErrorCode::MaxPoliciesReached
        );
        require!(
            insured_value <= protocol_state.max_insured_value,
            ErrorCode::InsuredValueTooHigh
        );
        require!(premium > 0, ErrorCode::InvalidAmount);
        require!(deductible_bps <= 10000, ErrorCode::InvalidDeductible);
        require!(duration_days >= 30 && duration_days <= 365, ErrorCode::InvalidDuration);

        let clock = Clock::get()?;
        let policy_id = protocol_state.total_policies + 1;

        policy.policy_id = policy_id;
        policy.customer = customer.owner;
        policy.coverage_type = coverage_type;
        policy.watch_details_hash = watch_details_hash;
        policy.insured_value = insured_value;
        policy.premium = premium;
        policy.deductible_bps = deductible_bps;
        policy.payment_frequency = payment_frequency;
        policy.start_date = clock.unix_timestamp;
        policy.expiry_date = clock.unix_timestamp + (duration_days as i64 * 86400);
        policy.status = PolicyStatus::Active;
        policy.total_paid = 0;
        policy.next_payment_due = clock.unix_timestamp + 30 * 86400;
        policy.claim_count = 0;
        policy.bump = ctx.bumps.policy;

        protocol_state.total_policies = policy_id;
        protocol_state.active_policies = protocol_state.active_policies
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        customer.policies.push(ctx.accounts.policy.key());

        emit!(PolicyCreatedEvent {
            policy_id,
            customer: customer.owner,
            insured_value,
            premium,
            coverage_type,
            timestamp: clock.unix_timestamp,
        });

        msg!("Policy {} created for customer {}", policy_id, customer.owner);
        Ok(())
    }

    pub fn pay_premium(
        ctx: Context<PayPremium>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let policy = &mut ctx.accounts.policy;
        let protocol_state = &ctx.accounts.protocol_state;

        require!(
            policy.status == PolicyStatus::Active,
            ErrorCode::PolicyNotActive
        );

        require!(
            amount >= policy.premium,
            ErrorCode::InsufficientPayment
        );

        let platform_fee = amount
            .checked_mul(protocol_state.platform_fee_bps as u64)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::DivisionByZero)?;

        let pool_amount = amount
            .checked_sub(platform_fee)
            .ok_or(ErrorCode::Underflow)?;

        let transfer_fee_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer_token_account.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        );
        token::transfer(transfer_fee_ctx, platform_fee)?;

        let transfer_pool_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer_token_account.to_account_info(),
                to: ctx.accounts.pool_vault.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        );
        token::transfer(transfer_pool_ctx, pool_amount)?;

        policy.total_paid = policy.total_paid
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        let clock = Clock::get()?;
        policy.next_payment_due = match policy.payment_frequency {
            PaymentFrequency::Monthly => clock.unix_timestamp + 30 * 86400,
            PaymentFrequency::Annual => policy.expiry_date,
        };

        let protocol_state = &mut ctx.accounts.protocol_state;
        protocol_state.total_premiums_collected = protocol_state.total_premiums_collected
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(PremiumPaidEvent {
            policy_id: policy.policy_id,
            customer: policy.customer,
            amount,
            platform_fee,
            pool_amount,
            timestamp: clock.unix_timestamp,
        });

        msg!("Premium paid: {} for policy {}", amount, policy.policy_id);
        Ok(())
    }

    pub fn cancel_policy(
        ctx: Context<CancelPolicy>,
    ) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        let protocol_state = &mut ctx.accounts.protocol_state;

        require!(
            ctx.accounts.customer.owner == policy.customer,
            ErrorCode::Unauthorized
        );

        require!(
            policy.status == PolicyStatus::Active,
            ErrorCode::PolicyNotActive
        );
        require!(
            policy.claim_count == 0,
            ErrorCode::CannotCancelWithClaims
        );

        policy.status = PolicyStatus::Cancelled;

        protocol_state.active_policies = protocol_state.active_policies
            .checked_sub(1)
            .ok_or(ErrorCode::Underflow)?;

        emit!(PolicyCancelledEvent {
            policy_id: policy.policy_id,
            customer: policy.customer,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Policy {} cancelled", policy.policy_id);
        Ok(())
    }

    pub fn update_policy_status(
        ctx: Context<UpdatePolicyStatus>,
        new_status: PolicyStatus,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.protocol_state.authority,
            ErrorCode::Unauthorized
        );

        let policy = &mut ctx.accounts.policy;
        let old_status = policy.status;
        policy.status = new_status;

        let protocol_state = &mut ctx.accounts.protocol_state;
        if old_status == PolicyStatus::Active && new_status != PolicyStatus::Active {
            protocol_state.active_policies = protocol_state.active_policies
                .checked_sub(1)
                .ok_or(ErrorCode::Underflow)?;
        } else if old_status != PolicyStatus::Active && new_status == PolicyStatus::Active {
            protocol_state.active_policies = protocol_state.active_policies
                .checked_add(1)
                .ok_or(ErrorCode::Overflow)?;
        }

        emit!(PolicyStatusUpdatedEvent {
            policy_id: policy.policy_id,
            old_status,
            new_status,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Policy {} status updated: {:?} -> {:?}", policy.policy_id, old_status, new_status);
        Ok(())
    }

    pub fn mark_policy_claimed(
        ctx: Context<MarkPolicyClaimed>,
    ) -> Result<()> {
        let policy = &mut ctx.accounts.policy;

        policy.claim_count = policy.claim_count
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        if policy.claim_count >= 1 {
            policy.status = PolicyStatus::Claimed;
        }

        emit!(PolicyClaimedEvent {
            policy_id: policy.policy_id,
            customer: policy.customer,
            claim_number: policy.claim_count,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Policy {} marked as claimed (claim #{})", policy.policy_id, policy.claim_count);
        Ok(())
    }

    pub fn flag_customer_fraud(
        ctx: Context<FlagCustomerFraud>,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.protocol_state.authority,
            ErrorCode::Unauthorized
        );

        let customer = &mut ctx.accounts.customer;
        customer.fraud_flags = customer.fraud_flags
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        emit!(CustomerFraudFlaggedEvent {
            customer: customer.owner,
            fraud_flags: customer.fraud_flags,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Customer {} flagged for fraud (flags: {})", customer.owner, customer.fraud_flags);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolState::INIT_SPACE,
        seeds = [b"protocol_state"],
        bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    /// CHECK: Treasury address
    pub treasury: AccountInfo<'info>,

    /// CHECK: Liquidity pool program
    pub liquidity_pool: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterCustomer<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Customer::INIT_SPACE,
        seeds = [b"customer", owner.key().as_ref()],
        bump
    )]
    pub customer: Account<'info, Customer>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyCustomer<'info> {
    #[account(
        seeds = [b"protocol_state"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [b"customer", customer.owner.as_ref()],
        bump = customer.bump
    )]
    pub customer: Account<'info, Customer>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreatePolicy<'info> {
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [b"customer", customer.owner.as_ref()],
        bump = customer.bump
    )]
    pub customer: Account<'info, Customer>,

    #[account(
        init,
        payer = payer,
        space = 8 + Policy::INIT_SPACE,
        seeds = [
            b"policy",
            customer.owner.as_ref(),
            &(protocol_state.total_policies + 1).to_le_bytes()
        ],
        bump
    )]
    pub policy: Account<'info, Policy>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayPremium<'info> {
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [
            b"policy",
            policy.customer.as_ref(),
            &policy.policy_id.to_le_bytes()
        ],
        bump = policy.bump
    )]
    pub policy: Account<'info, Policy>,

    #[account(mut)]
    pub payer_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelPolicy<'info> {
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        seeds = [b"customer", customer.owner.as_ref()],
        bump = customer.bump
    )]
    pub customer: Account<'info, Customer>,

    #[account(
        mut,
        seeds = [
            b"policy",
            policy.customer.as_ref(),
            &policy.policy_id.to_le_bytes()
        ],
        bump = policy.bump
    )]
    pub policy: Account<'info, Policy>,

    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdatePolicyStatus<'info> {
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [
            b"policy",
            policy.customer.as_ref(),
            &policy.policy_id.to_le_bytes()
        ],
        bump = policy.bump
    )]
    pub policy: Account<'info, Policy>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct MarkPolicyClaimed<'info> {
    #[account(
        mut,
        seeds = [
            b"policy",
            policy.customer.as_ref(),
            &policy.policy_id.to_le_bytes()
        ],
        bump = policy.bump
    )]
    pub policy: Account<'info, Policy>,

    /// CHECK: Only claims-processor program can call this
    pub claims_processor: Signer<'info>,
}

#[derive(Accounts)]
pub struct FlagCustomerFraud<'info> {
    #[account(
        seeds = [b"protocol_state"],
        bump = protocol_state.bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [b"customer", customer.owner.as_ref()],
        bump = customer.bump
    )]
    pub customer: Account<'info, Customer>,

    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct ProtocolState {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub liquidity_pool: Pubkey,
    pub platform_fee_bps: u16,
    pub total_policies: u64,
    pub active_policies: u64,
    pub max_policies: u64,
    pub max_insured_value: u64,
    pub total_premiums_collected: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Customer {
    pub owner: Pubkey,
    pub kyc_hash: [u8; 32],
    pub kyc_verified: bool,
    pub kyc_verified_at: i64,
    #[max_len(10)]
    pub policies: Vec<Pubkey>,
    pub total_claims: u64,
    pub fraud_flags: u8,
    pub created_at: i64,
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
pub struct ProtocolInitializedEvent {
    pub authority: Pubkey,
    pub platform_fee_bps: u16,
    pub max_policies: u64,
    pub timestamp: i64,
}

#[event]
pub struct CustomerRegisteredEvent {
    pub customer: Pubkey,
    pub kyc_hash: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct CustomerVerifiedEvent {
    pub customer: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PolicyCreatedEvent {
    pub policy_id: u64,
    pub customer: Pubkey,
    pub insured_value: u64,
    pub premium: u64,
    pub coverage_type: CoverageType,
    pub timestamp: i64,
}

#[event]
pub struct PremiumPaidEvent {
    pub policy_id: u64,
    pub customer: Pubkey,
    pub amount: u64,
    pub platform_fee: u64,
    pub pool_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct PolicyCancelledEvent {
    pub policy_id: u64,
    pub customer: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PolicyStatusUpdatedEvent {
    pub policy_id: u64,
    pub old_status: PolicyStatus,
    pub new_status: PolicyStatus,
    pub timestamp: i64,
}

#[event]
pub struct PolicyClaimedEvent {
    pub policy_id: u64,
    pub customer: Pubkey,
    pub claim_number: u8,
    pub timestamp: i64,
}

#[event]
pub struct CustomerFraudFlaggedEvent {
    pub customer: Pubkey,
    pub fraud_flags: u8,
    pub timestamp: i64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Fee cannot exceed 20%")]
    FeeTooHigh,

    #[msg("Exceeds regulatory limits (5000 policies or 30k CHF)")]
    ExceedsRegulationLimit,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("KYC not verified")]
    KYCNotVerified,

    #[msg("Maximum policies reached")]
    MaxPoliciesReached,

    #[msg("Insured value too high")]
    InsuredValueTooHigh,

    #[msg("Invalid deductible percentage")]
    InvalidDeductible,

    #[msg("Invalid policy duration")]
    InvalidDuration,

    #[msg("Policy is not active")]
    PolicyNotActive,

    #[msg("Insufficient payment amount")]
    InsufficientPayment,

    #[msg("Cannot cancel policy with claims")]
    CannotCancelWithClaims,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Arithmetic underflow")]
    Underflow,

    #[msg("Division by zero")]
    DivisionByZero,

    #[msg("Unauthorized")]
    Unauthorized,
}