var test = require('node:test');
var assert = require('node:assert');
var dice = require('../src/index.js');

function makeReveal() {
  var serverSeed = 'reveal-server-seed-example';
  var clientSeedHost = 'host-seed-example';
  var clientSeedGuest = 'guest-seed-example';
  var rollLog = [];
  for (var nonce = 0; nonce < 5; nonce++) {
    var count = nonce === 0 ? 1 : 2; // pretend nonce 0 is an opening die
    rollLog.push({
      nonce: nonce,
      count: count,
      values: dice.deriveValues({ serverSeed: serverSeed, clientSeedHost: clientSeedHost, clientSeedGuest: clientSeedGuest, nonce: nonce, count: count })
    });
  }
  return {
    serverSeed: serverSeed,
    clientSeedHost: clientSeedHost,
    clientSeedGuest: clientSeedGuest,
    commitmentHash: dice.commitmentHash(serverSeed),
    rollLog: rollLog
  };
}

test('an untampered reveal verifies as fully valid', function () {
  var reveal = makeReveal();
  var result = dice.verifyReveal(reveal);
  assert.strictEqual(result.commitmentValid, true);
  assert.strictEqual(result.allValid, true);
  assert.ok(result.rolls.every(function (r) { return r.valid; }));
});

test('a wrong commitment hash is caught even if all rolls still recompute correctly', function () {
  var reveal = makeReveal();
  reveal.commitmentHash = '0'.repeat(64);
  var result = dice.verifyReveal(reveal);
  assert.strictEqual(result.commitmentValid, false);
  assert.strictEqual(result.allValid, false);
});

test('a tampered roll value (server claims a different result than it actually produced) is caught', function () {
  var reveal = makeReveal();
  var tamperedNonce = 2;
  reveal.rollLog[tamperedNonce].values = reveal.rollLog[tamperedNonce].values.map(function (v) {
    return (v % 6) + 1; // shift to a different value
  });
  var result = dice.verifyReveal(reveal);
  assert.strictEqual(result.allValid, false);
  var flagged = result.rolls.find(function (r) { return r.nonce === tamperedNonce; });
  assert.strictEqual(flagged.valid, false);
  // Untouched rolls must still verify fine
  var untouched = result.rolls.filter(function (r) { return r.nonce !== tamperedNonce; });
  assert.ok(untouched.every(function (r) { return r.valid; }));
});

test('a different revealed serverSeed than the one actually committed to is caught', function () {
  var reveal = makeReveal();
  var realCommitment = reveal.commitmentHash;
  reveal.serverSeed = 'a-different-seed-the-server-swapped-in';
  reveal.commitmentHash = realCommitment; // still claims the original commitment
  var result = dice.verifyReveal(reveal);
  assert.strictEqual(result.commitmentValid, false);
});
