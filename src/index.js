/**
 * backgammon-dice-roller
 *
 * A commit-reveal, HMAC-based dice formula: the same pattern used by
 * well-known "provably fair" crypto-casino dice games (server commits to a
 * secret seed's hash before play, reveals the seed afterward, and every die
 * value is a verifiable, deterministic function of that seed plus each
 * player's own contributed seed and a per-roll nonce).
 *
 * Seeds are always treated as plain UTF-8 strings (in practice hex), never
 * hex-decoded to raw bytes, for both the HMAC key and the message. This
 * matches the common provably-fair convention and avoids "hex vs raw bytes"
 * ambiguity for anyone re-implementing or manually checking the formula.
 *
 * Depends only on ./sha256.js (a plain-JS SHA-256/HMAC implementation with
 * no external dependencies), so this same file runs unmodified in Node,
 * in a browser over HTTPS, and in a browser opened from a local file.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./sha256.js'));
  } else {
    root.BackgammonProvablyFair = factory(root.BPFSha256);
  }
})(typeof self !== 'undefined' ? self : this, function (sha) {
  'use strict';

  var REJECTION_CEILING = 252; // largest multiple of 6 that fits in a byte (6 * 42)

  function sha256Hex(str) {
    return sha.bytesToHex(sha.sha256(sha.utf8ToBytes(str)));
  }

  function hmacSha256Bytes(keyStr, msgStr) {
    return sha.hmacSha256(sha.utf8ToBytes(keyStr), sha.utf8ToBytes(msgStr));
  }

  /**
   * The public commitment for a server seed: sha256(serverSeed).
   * Published before any roll happens; only meaningful once serverSeed is
   * later revealed and this can be recomputed to match.
   */
  function commitmentHash(serverSeed) {
    return sha256Hex(serverSeed);
  }

  function rollMessage(clientSeedHost, clientSeedGuest, nonce) {
    return clientSeedHost + ':' + clientSeedGuest + ':' + nonce;
  }

  /**
   * Derive `count` dice values (1-6) for one roll, deterministically, from
   * the match's seeds and this roll's nonce. Pure function — no I/O, no
   * randomness — so any two parties computing this from the same inputs
   * always get the same output.
   *
   * @param {Object} params
   * @param {string} params.serverSeed - revealed secret seed for the match
   * @param {string} params.clientSeedHost
   * @param {string} params.clientSeedGuest
   * @param {number} params.nonce - increments once per roll (opening die or turn roll)
   * @param {number} params.count - how many die values this roll needs (1 or 2)
   * @returns {number[]} `count` values, each 1-6, in the order they were drawn
   */
  function deriveValues(params) {
    var serverSeed = params.serverSeed;
    var message = rollMessage(params.clientSeedHost, params.clientSeedGuest, params.nonce);
    var count = params.count;

    var values = [];
    var extra = 0;
    var digest = hmacSha256Bytes(serverSeed, message);
    var cursor = 0;

    while (values.length < count) {
      if (cursor >= digest.length) {
        extra += 1;
        digest = hmacSha256Bytes(serverSeed, message + ':' + extra);
        cursor = 0;
      }
      var byte = digest[cursor];
      cursor += 1;
      if (byte >= REJECTION_CEILING) continue; // modulo-bias rejection
      values.push((byte % 6) + 1);
    }

    return values;
  }

  /**
   * Verify a fully-revealed match: checks the commitment hash matches the
   * revealed serverSeed, and recomputes every logged roll to confirm it
   * matches what was actually shown/played.
   *
   * @param {Object} reveal
   * @param {string} reveal.serverSeed
   * @param {string} reveal.clientSeedHost
   * @param {string} reveal.clientSeedGuest
   * @param {string} reveal.commitmentHash
   * @param {Array<{nonce:number, count:number, values:number[]}>} reveal.rollLog
   */
  function verifyReveal(reveal) {
    var commitmentValid = commitmentHash(reveal.serverSeed) === reveal.commitmentHash;

    var rolls = (reveal.rollLog || []).map(function (entry) {
      var expected = deriveValues({
        serverSeed: reveal.serverSeed,
        clientSeedHost: reveal.clientSeedHost,
        clientSeedGuest: reveal.clientSeedGuest,
        nonce: entry.nonce,
        count: entry.count
      });
      var actual = entry.values;
      var valid = expected.length === actual.length && expected.every(function (v, i) { return v === actual[i]; });
      return { nonce: entry.nonce, count: entry.count, expected: expected, actual: actual, valid: valid };
    });

    var allValid = commitmentValid && rolls.every(function (r) { return r.valid; });

    return { commitmentValid: commitmentValid, rolls: rolls, allValid: allValid };
  }

  /**
   * Generate a random hex seed. Only used to *create* seeds (server seed,
   * or a player's own client-side seed) — never used by verification, which
   * is purely deterministic given seeds that already exist.
   * @param {number} byteLength
   */
  function generateSeedHex(byteLength) {
    byteLength = byteLength || 32;
    if (typeof module === 'object' && module.exports) {
      // Node
      var nodeCrypto = require('crypto');
      return nodeCrypto.randomBytes(byteLength).toString('hex');
    }
    // Browser
    var bytes = new Uint8Array(byteLength);
    (self.crypto || self.msCrypto).getRandomValues(bytes);
    return sha.bytesToHex(bytes);
  }

  return {
    sha256Hex: sha256Hex,
    commitmentHash: commitmentHash,
    deriveValues: deriveValues,
    verifyReveal: verifyReveal,
    generateSeedHex: generateSeedHex,
    _internal: { rollMessage: rollMessage, hmacSha256Bytes: hmacSha256Bytes, REJECTION_CEILING: REJECTION_CEILING }
  };
});
