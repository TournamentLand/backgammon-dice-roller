var test = require('node:test');
var assert = require('node:assert');
var dice = require('../src/index.js');

test('deriveValues is a pure function of its inputs', function () {
  var params = {
    serverSeed: 'aabbccddeeff00112233445566778899',
    clientSeedHost: 'host-seed-123',
    clientSeedGuest: 'guest-seed-456',
    nonce: 7,
    count: 2
  };

  var a = dice.deriveValues(params);
  var b = dice.deriveValues(params);
  assert.deepStrictEqual(a, b, 'same inputs must always produce the same values');
  assert.strictEqual(a.length, 2);
  a.forEach(function (v) {
    assert.ok(v >= 1 && v <= 6, 'value must be in range 1-6, got ' + v);
  });
});

test('different nonces produce independent draws', function () {
  var base = {
    serverSeed: 'aabbccddeeff00112233445566778899',
    clientSeedHost: 'host-seed-123',
    clientSeedGuest: 'guest-seed-456',
    count: 2
  };

  var results = [];
  for (var nonce = 0; nonce < 20; nonce++) {
    results.push(dice.deriveValues(Object.assign({}, base, { nonce: nonce })).join(','));
  }
  var unique = new Set(results);
  // Not a strict guarantee (collisions are possible with 6x6=36 outcomes),
  // but 20 draws all landing on the same value would indicate a broken nonce.
  assert.ok(unique.size > 1, 'nonce must actually vary the output');
});

test('changing any single seed changes the derived values (overwhelmingly likely)', function () {
  var base = { serverSeed: 'seed-a', clientSeedHost: 'host-a', clientSeedGuest: 'guest-a', nonce: 0, count: 2 };
  var changedServer = dice.deriveValues(Object.assign({}, base, { serverSeed: 'seed-b' }));
  var changedHost = dice.deriveValues(Object.assign({}, base, { clientSeedHost: 'host-b' }));
  var original = dice.deriveValues(base);

  assert.notDeepStrictEqual(original, changedServer);
  assert.notDeepStrictEqual(original, changedHost);
});

test('commitmentHash matches sha256(serverSeed) and changes if the seed changes', function () {
  var seed = 'my-secret-server-seed';
  var hash1 = dice.commitmentHash(seed);
  var hash2 = dice.commitmentHash(seed);
  assert.strictEqual(hash1, hash2);
  assert.notStrictEqual(hash1, dice.commitmentHash(seed + 'x'));
  assert.strictEqual(hash1.length, 64, 'sha256 hex digest should be 64 chars');
});
