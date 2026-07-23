var test = require('node:test');
var assert = require('node:assert');
var dice = require('../src/index.js');

// This is the actual statistical proof that the formula doesn't favor any
// die value: a chi-square goodness-of-fit test against a uniform 1-6
// distribution, run on a large number of independently-nonced draws.
test('dice values are uniformly distributed across a large sample (chi-square test)', function () {
  var N = 200000;
  var counts = [0, 0, 0, 0, 0, 0];
  var serverSeed = 'uniformity-test-server-seed';
  var clientSeedHost = 'uniformity-test-host-seed';
  var clientSeedGuest = 'uniformity-test-guest-seed';

  for (var nonce = 0; nonce < N; nonce++) {
    var value = dice.deriveValues({
      serverSeed: serverSeed,
      clientSeedHost: clientSeedHost,
      clientSeedGuest: clientSeedGuest,
      nonce: nonce,
      count: 1
    })[0];
    counts[value - 1] += 1;
  }

  var expected = N / 6;
  var chiSquare = counts.reduce(function (sum, observed) {
    return sum + Math.pow(observed - expected, 2) / expected;
  }, 0);

  // Critical value for df=5 at p=0.001 is ~20.5; a real modulo-bias bug
  // produces chi-square values orders of magnitude larger than this, so a
  // generous threshold avoids test flakiness while still catching real bugs.
  var CRITICAL_VALUE = 30;

  console.log('Sample size: ' + N + ', counts: ' + counts.join(', ') + ', chi-square: ' + chiSquare.toFixed(3));
  assert.ok(
    chiSquare < CRITICAL_VALUE,
    'chi-square statistic ' + chiSquare.toFixed(3) + ' exceeds ' + CRITICAL_VALUE + ' — distribution looks biased'
  );
});

test('no single value dominates or is starved across many rolls of 2 dice', function () {
  var N = 20000;
  var counts = [0, 0, 0, 0, 0, 0];
  for (var nonce = 0; nonce < N; nonce++) {
    var values = dice.deriveValues({
      serverSeed: 'pair-test-seed',
      clientSeedHost: 'host',
      clientSeedGuest: 'guest',
      nonce: nonce,
      count: 2
    });
    values.forEach(function (v) { counts[v - 1] += 1; });
  }
  var total = N * 2;
  counts.forEach(function (c, i) {
    var frac = c / total;
    assert.ok(frac > 0.14 && frac < 0.20, 'value ' + (i + 1) + ' occurred ' + (frac * 100).toFixed(2) + '% of the time, expected ~16.7%');
  });
});
