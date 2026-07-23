#!/usr/bin/env node
/**
 * CLI for backgammon-dice-roller — run this yourself, on your own machine,
 * instead of trusting that the website's verifier hasn't been tampered with.
 *
 * Two modes:
 *
 *   Single roll:
 *     node bin/verify.js --serverSeed=<hex> --clientSeedHost=<hex> \
 *       --clientSeedGuest=<hex> --nonce=0 --count=2
 *
 *   Full match reveal (as downloaded/copied from a match's "Verify Fairness"
 *   panel — a JSON object with serverSeed, clientSeedHost, clientSeedGuest,
 *   commitmentHash, rollLog):
 *     node bin/verify.js --reveal=./match-reveal.json
 */
var fs = require('fs');
var path = require('path');
var dice = require(path.join(__dirname, '..', 'src', 'index.js'));

function parseArgs(argv) {
  var args = {};
  argv.forEach(function (arg) {
    var match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) args[match[1]] = match[2];
  });
  return args;
}

function main() {
  var args = parseArgs(process.argv.slice(2));

  if (args.reveal) {
    var raw = fs.readFileSync(args.reveal, 'utf8');
    var reveal = JSON.parse(raw);
    var result = dice.verifyReveal(reveal);

    console.log('Commitment hash matches revealed seed: ' + (result.commitmentValid ? 'YES' : 'NO'));
    console.log('');
    result.rolls.forEach(function (roll) {
      var status = roll.valid ? 'OK ' : 'FAIL';
      console.log('[' + status + '] nonce=' + roll.nonce + ' expected=' + roll.expected.join(',') + ' actual=' + roll.actual.join(','));
    });
    console.log('');
    console.log(result.allValid ? 'ALL ROLLS VERIFIED — match was fair.' : 'VERIFICATION FAILED — see FAIL lines above.');
    process.exitCode = result.allValid ? 0 : 1;
    return;
  }

  if (args.serverSeed && args.clientSeedHost !== undefined && args.clientSeedGuest !== undefined && args.nonce !== undefined) {
    var values = dice.deriveValues({
      serverSeed: args.serverSeed,
      clientSeedHost: args.clientSeedHost,
      clientSeedGuest: args.clientSeedGuest,
      nonce: Number(args.nonce),
      count: args.count !== undefined ? Number(args.count) : 2
    });
    console.log('Dice values: ' + values.join(', '));
    console.log('sha256(serverSeed) commitment: ' + dice.commitmentHash(args.serverSeed));
    return;
  }

  console.log('Usage:');
  console.log('  node bin/verify.js --serverSeed=<hex> --clientSeedHost=<hex> --clientSeedGuest=<hex> --nonce=0 --count=2');
  console.log('  node bin/verify.js --reveal=./match-reveal.json');
  process.exitCode = 1;
}

main();
