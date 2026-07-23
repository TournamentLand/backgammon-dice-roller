# backgammon-dice-roller

English | [فارسی](README.fa.md)

A provably-fair, HMAC-based dice roll formula for online backgammon.

This is the actual code that generates and verifies dice rolls in production
for [Tournament Land](https://tournamentland.com)'s backgammon tables. It's
published here, on its own, so that:

- anyone can read exactly how a roll is produced — no ambiguity, no "trust us"
- anyone can independently re-derive and check any revealed match's rolls,
  without needing our website, our server, or even an internet connection
- the client and server code the game actually runs both depend on this
  package directly (not a hand-copied reimplementation), so what's published
  here is provably what's running, not a lookalike

## The problem this solves

A backgammon server could, in principle, choose "convenient" dice values
instead of random ones. Using a good CSPRNG server-side (which this project's
production code already did before this scheme existed) prevents *statistical*
bias, but it still asks players to trust the server's word that it did so.

This scheme instead makes every roll **independently checkable after the
fact**, using the same commit-reveal pattern well-known crypto-casino dice
games use:

1. Before a match starts, the server generates a secret `serverSeed` and
   publishes `sha256(serverSeed)` — the **commitment** — to both players.
   Neither player has seen it yet, but its hash is now on record.
2. Each player's own client generates a random `clientSeed` in their own
   browser (never on the server) and sends it up. The server cannot predict
   or choose this value.
3. Every roll is derived by combining `serverSeed`, both `clientSeed`s, and
   an incrementing `nonce` (one per roll) through HMAC-SHA256, then mapping
   the resulting bytes to dice values 1-6 with rejection sampling (see
   below) to avoid modulo bias.
4. When the match ends, the server reveals `serverSeed`. Anyone can now:
   - confirm `sha256(serverSeed)` matches the commitment published *before*
     the match started (so the server couldn't have picked a different seed
     after seeing how the match went), and
   - recompute every single roll from the revealed seeds and confirm it
     matches what was actually shown and played during the match.

Because HMAC-SHA256 is a pseudorandom function, there's no computationally
feasible way for the server to find a `serverSeed` that reproduces a chosen
sequence of "convenient" rolls after the fact — it would have to break
HMAC-SHA256 itself.

## The formula

Seeds (`serverSeed`, `clientSeedHost`, `clientSeedGuest`) are always plain
UTF-8 strings — in practice hex strings — used directly as HMAC key/message
material, never separately hex-decoded to raw bytes. This avoids "hex vs raw
bytes" ambiguity for anyone re-implementing or manually checking the formula.

```
message = `${clientSeedHost}:${clientSeedGuest}:${nonce}`
digest  = HMAC-SHA256(key = serverSeed, message)

for each requested die value, consume the next unused byte of digest:
  if byte >= 252: discard it, take the next byte   // 252 = 6 × 42
  else: value = (byte % 6) + 1

if digest is exhausted before enough values are drawn:
  digest = HMAC-SHA256(serverSeed, `${message}:${extraCounter}`)
  extraCounter = 1, 2, 3, ...  (continue consuming from this new digest)
```

**Why reject bytes ≥ 252?** A byte is uniform over 0-255 (256 values). 256 is
not divisible by 6, so `byte % 6` alone is slightly biased toward 0-3 over
4-5. 252 = 6 × 42 is the largest multiple of 6 that fits in a byte, so
restricting to bytes 0-251 (252 values, exactly 42 per remainder) and
discarding the rest removes the bias entirely. This is the same technique
[Backgammon Galaxy's `dice_roller`](https://github.com/Backgammon-Galaxy/dice_roller)
uses (rejecting bytes ≥ 252 before `rem(byte, 6) + 1`), and the same thing
Node's `crypto.randomInt` does internally.

One **nonce is consumed per draw**, regardless of how many values that draw
needs — an opening die draws 1 value from its own nonce; a turn roll draws 2
values from one nonce.

## Verifying a match yourself

You don't have to trust that our website's JavaScript is unmodified. Two
ways to check independently:

**In a browser, offline:**
```
Download verify.html from this repo and open it directly (no server needed).
Paste the revealed match JSON (serverSeed, clientSeedHost, clientSeedGuest,
commitmentHash, rollLog) and click Verify.
```

**On the command line:**
```bash
node bin/verify.js --reveal=./match-reveal.json
# or check one roll by hand:
node bin/verify.js --serverSeed=<hex> --clientSeedHost=<hex> \
  --clientSeedGuest=<hex> --nonce=0 --count=2
```

## API

```js
const dice = require('backgammon-dice-roller');

dice.commitmentHash(serverSeed);
// => sha256 hex digest, published before the match starts

dice.deriveValues({ serverSeed, clientSeedHost, clientSeedGuest, nonce, count });
// => [3, 5]  (array of `count` values, 1-6)

dice.verifyReveal({ serverSeed, clientSeedHost, clientSeedGuest, commitmentHash, rollLog });
// => { commitmentValid, rolls: [{nonce, count, expected, actual, valid}, ...], allValid }

dice.generateSeedHex(32);
// => a fresh random hex seed (Node crypto.randomBytes / browser crypto.getRandomValues)
// only used to CREATE seeds — verification never needs this.
```

`src/index.js` and `src/sha256.js` have zero dependencies and run unmodified
in Node, in a browser over HTTPS, or in a browser opened straight from a
local file — one code path, not "the same algorithm reimplemented twice and
hoping they agree."

## Testing

```bash
npm test
```

Includes determinism tests, tamper-detection tests (a mismatched commitment,
a tampered roll, or a swapped seed are all caught), and a chi-square
goodness-of-fit test over 200,000 draws confirming the 1-6 distribution is
statistically uniform — that test's output is itself part of the public
proof, since anyone can clone this repo and run it.

## License

MIT
