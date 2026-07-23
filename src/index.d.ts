export interface DeriveValuesParams {
  /** Revealed secret seed for the match. */
  serverSeed: string;
  clientSeedHost: string;
  clientSeedGuest: string;
  /** Increments once per roll (opening die or turn roll). */
  nonce: number;
  /** How many die values this roll needs (1 for an opening die, 2 for a turn roll). */
  count: number;
}

export interface RollLogEntry {
  nonce: number;
  count: number;
  values: number[];
}

export interface ProvablyFairReveal {
  serverSeed: string;
  clientSeedHost: string;
  clientSeedGuest: string;
  commitmentHash: string;
  rollLog: RollLogEntry[];
}

export interface RollVerification extends RollLogEntry {
  expected: number[];
  actual: number[];
  valid: boolean;
}

export interface VerifyRevealResult {
  commitmentValid: boolean;
  rolls: RollVerification[];
  allValid: boolean;
}

/** sha256(input), returned as a lowercase hex string. */
export function sha256Hex(input: string): string;

/** The public commitment for a server seed: sha256(serverSeed). */
export function commitmentHash(serverSeed: string): string;

/** Derive `count` dice values (1-6) for one roll, deterministically. */
export function deriveValues(params: DeriveValuesParams): number[];

/** Verify a fully-revealed match against its rollLog. */
export function verifyReveal(reveal: ProvablyFairReveal): VerifyRevealResult;

/** Generate a fresh random hex seed. Only used to create seeds, never to verify them. */
export function generateSeedHex(byteLength?: number): string;
