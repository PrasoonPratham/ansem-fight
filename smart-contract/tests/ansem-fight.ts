import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("game-finance", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.GameFinance;

  it("multiple deposits and leaderboard simulation with extensive scenarios", async () => {
    console.log(
      "\n** Starting test for multiple deposits and leaderboard simulation... **"
    );

    // Finding the vault PDA
    const [vaultPDA] = await PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );
    console.log(`Vault PDA: ${vaultPDA.toString()}`);

    const depositors = [new Keypair(), new Keypair(), new Keypair()];
    const deposits = [
      [3 * LAMPORTS_PER_SOL, 1 * LAMPORTS_PER_SOL], // Multiple deposits by first depositor
      [5 * LAMPORTS_PER_SOL], // Single large deposit by second depositor
      [2 * LAMPORTS_PER_SOL, 2 * LAMPORTS_PER_SOL, 1 * LAMPORTS_PER_SOL], // Multiple deposits by third depositor
    ];
    const expectedVaultTotal = deposits.flat().reduce((a, b) => a + b, 0);

    let depositorTotals = {};

    // Prepare PDAs for each depositor
    const depositorPDAs = await Promise.all(
      depositors.map((depositor) =>
        PublicKey.findProgramAddressSync(
          [Buffer.from("depositor"), depositor.publicKey.toBuffer()],
          program.programId
        )
      )
    );

    // Process deposits for each depositor
    for (let i = 0; i < depositors.length; i++) {
      const depositor = depositors[i];
      const depositorPDA = depositorPDAs[i][0];
      console.log(
        `Processing deposits for depositor ${
          i + 1
        } with PDA: ${depositorPDA.toString()}`
      );

      // Fund the depositor account to cover all deposits and transaction fees
      const airdropTx = await provider.connection.requestAirdrop(
        depositor.publicKey,
        10 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropTx, "confirmed");
      console.log(`Airdrop confirmed for depositor ${i + 1}`);

      for (let depositAmount of deposits[i]) {
        console.log(
          `Depositor ${i + 1} depositing ${
            depositAmount / LAMPORTS_PER_SOL
          } SOL`
        );

        // Execute the deposit transaction
        const tx = await program.rpc.depositSol(new anchor.BN(depositAmount), {
          accounts: {
            payer: depositor.publicKey,
            vault: vaultPDA,
            depositor: depositorPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          },
          signers: [depositor],
        });
        await provider.connection.confirmTransaction(tx, "confirmed");
        console.log(
          `Deposit transaction confirmed for ${
            depositAmount / LAMPORTS_PER_SOL
          } SOL by depositor ${i + 1}`
        );

        // Update the total deposited by this depositor
        depositorTotals[depositor.publicKey.toBase58()] =
          (depositorTotals[depositor.publicKey.toBase58()] || 0) +
          depositAmount;
      }
    }

    // Prepare and sort the final leaderboard
    const finalLeaderboard = Object.entries(depositorTotals).map(
      ([depositor, totalDeposited]) => ({
        depositor,
        totalDeposited: (totalDeposited as any) / LAMPORTS_PER_SOL,
      })
    );
    finalLeaderboard.sort((a, b) => b.totalDeposited - a.totalDeposited);

    console.log("\nFinal Leaderboard:");
    finalLeaderboard.forEach((entry, index) => {
      console.log(
        `Rank ${index + 1}: Depositor ${entry.depositor}, ${
          entry.totalDeposited
        } SOL`
      );
    });

    // Verify the total deposited in the vault
    const vaultAccount = await program.account.vault.fetch(vaultPDA);
    assert.strictEqual(
      vaultAccount.totalDeposited.toNumber(),
      expectedVaultTotal,
      `Vault total should be ${expectedVaultTotal / LAMPORTS_PER_SOL} SOL`
    );
    console.log(
      `\nTest completed. Vault total matches expected: ${
        expectedVaultTotal / LAMPORTS_PER_SOL
      } SOL`
    );
  });
});
