#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("F9ufrD6qJ87S5uhhCHPJa6jcrP5DCo3Gdn11hFvj3cef");

#[program]
pub mod wif_game {
    use super::*;

    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let depositor = &mut ctx.accounts.depositor;

        // Ensuring the transfer from the payer to the vault is successful
        let cpi_accounts = system_program::Transfer {
            from: ctx.accounts.payer.to_account_info(),
            to: vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.system_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        system_program::transfer(cpi_ctx, amount).map_err(|_| {
            msg!("Failed to transfer funds");
            ProgramError::Custom(0) // Custom error code
        })?;

        // Updating the total deposited amounts for both vault and depositor accounts
        vault.total_deposited += amount;
        depositor.total_deposited += amount;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init_if_needed,
        seeds = [b"vault"],
        bump,
        payer = payer,
        space = 8 + 8 
    )]
    vault: Account<'info, Vault>,
    #[account(
        init_if_needed,
        seeds = [b"depositor", payer.key().as_ref()],
        bump,
        payer = payer,
        space = 8 + 8 
    )]
    depositor: Account<'info, Depositor>,
    system_program: Program<'info, System>,
}

#[account]
pub struct Vault {
    total_deposited: u64,
}

#[account]
pub struct Depositor {
    total_deposited: u64,
}