#! /usr/bin/env node

import yargs from 'yargs';

function load(modulePath) {
  // Lazy-load so light commands (and --help) do not pull in heavy deps like ncu/pacote.
  // eslint-disable-next-line global-require
  return require(modulePath);
}

yargs
  .command({
    command: 'check [filter]',
    aliases: '*',
    describe: 'Check for outdated modules',
    builder: yargs => load('../commands/check').builder(yargs),
    handler: argv => load('../commands/check').handler(argv)
  })
  .command({
    command: 'ignore <command>',
    describe: 'Manage ignored modules',
    builder: yargs => load('../commands/ignore').builder(yargs)
  })
  .command({
    command: 'changelog <moduleName>',
    describe: 'Show changelog for a module',
    handler: argv => load('../commands/changelog').handler(argv)
  })
  .demandCommand()
  .strict()
  .version()
  .help()
  .argv;
