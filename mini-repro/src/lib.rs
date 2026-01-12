use anchor_lang::prelude::*;
declare_id!("11111111111111111111111111111111");

#[derive(Accounts)]
pub struct MyAccounts<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
}

#[program]
pub mod mini_repro {
    use super::*;

    pub fn do_something(ctx: Context<MyAccounts>) -> Result<()> {
        Ok(())
    }
}
