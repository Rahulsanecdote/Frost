# @frost/engine

Pure TypeScript contracts for Frost's on-device branch engine. The package currently exports the exact snapshot, event, commitment, commute, history, grant, branch, and resolution types from the project brief. No type extensions have been introduced. There are no runtime dependencies.

The planned model uses seeded Monte Carlo simulation of empirical arrival and meeting-overrun histories, widened by commute estimates. Overruns propagate into subsequent events and reduce the time available for commitments. Branch probabilities are simulated frequencies, including a clear-day outcome. Inputs must respect permission grants and the fixed 24-hour horizon.

The forecasting API, permission enforcement, ledger, resolution logging, fixtures, and calibration tests are not implemented yet. The current test checks only the initial type contract; it does not establish model correctness or calibration. Synthetic calibration, when implemented, will not establish real-world calibration.

Run `pnpm --filter @frost/engine typecheck` and `pnpm --filter @frost/engine test` from the repository root.

Licensed under MIT; see LICENSE.
