// Copyright (c) 2018-2019, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

require('dotenv').config()
const BlockChainCollector = require('./lib/blockchainCollector')
const DatabaseBackend = require('./lib/databaseBackend')
const Logger = require('./lib/logger')
const Metronome = require('node-metronome')

/* Load in our environment variables */
const env = {
  enableDebugging: !!((typeof process.env.TURTLEPAY_DEBUG !== 'undefined' && (process.env.TURTLEPAY_DEBUG.toUpperCase() === 'ON' || parseInt(process.env.TURTLEPAY_DEBUG) === 1))),
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    username: process.env.MYSQL_USERNAME || false,
    password: process.env.MYSQL_PASSWORD || false,
    database: process.env.MYSQL_DATABASE || false,
    connectionLimit: process.env.MYSQL_CONNECTION_LIMIT || 10
  },
  node: {
    host: process.env.NODE_HOST || 'localhost',
    port: process.env.NODE_PORT || 11898
  },
  storeRawTransactionExtra: process.env.STORE_RAW_TRANSACTION_EXTRA || false
}

if (!process.env.NODE_ENV || process.env.NODE_ENV.toLowerCase() !== 'production') {
  Logger.warning('Node.js is not running in production mode. Consider running in production mode: export NODE_ENV=production')
}

/* Sanity check to make sure we have connection information
   for the database and node */
if (!env.mysql.host || !env.mysql.port || !env.mysql.username || !env.mysql.password || !env.mysql.database || !env.node.host || !env.node.port) {
  Logger.error('It looks like you did not export all of the required connection information into your environment variables before attempting to start the service.')
  process.exit(0)
}

/* We're going to go ahead and create our timer but pause it until
   we know that we have the genesis hash in the database */
const timer = new Metronome(2000)
timer.pause = true

/* Timer to fire to get the transaction pool information */
const transactionPoolTimer = new Metronome(5000, true)

/* Timer to fire to get the network information */
const informationTimer = new Metronome(5000, true)

/* Set up our database connection */
const database = new DatabaseBackend({
  host: env.mysql.host,
  port: env.mysql.port,
  username: env.mysql.username,
  password: env.mysql.password,
  database: env.mysql.database,
  connectionLimit: env.mysql.connectionLimit,
  storeRawTransactionExtra: env.storeRawTransactionExtra
})

/* Set up our blockchain collector so that we can actually query
   the daemon and go get block details. The timeout is set
   statically to 60s for the time being so that we can monitor
   performance as it plays catch up */
const collector = new BlockChainCollector({
  host: env.node.host,
  port: env.node.port,
  timeout: 120000
})

if (env.enableDebugging) collector.on('debug', message => Logger.debug('[DEBUG] %s', message))

function rewind () {
  var toHeight = 0;

  return database.getLastKnownBlockHeight()
    .then(height => {
      toHeight = height - 10

      if (toHeight < 0) {
        toHeight = 0
      }

      Logger.info('Database contains blocks up to block #%s', height || 0)
    })
    .then(() => { return database.buildDeleteBlocksFromHeightQueries(toHeight) })
    .then(queries => { return database._insertTransaction(queries) })
    .then(results => {
      if (results.length === 0) {
        Logger.warning('No blocks found beyond block #%s', toHeight - 1)
      } else {
        Logger.warning('Executed %s queries', results.length)
      }
    })
    .then(() => Logger.info('Database rewound to block #%s', toHeight - 1))
    .catch(error => {
      Logger.error(error);
    })
}

database.haveGenesis()
  .then(haveGenesis => {
    /* Check to see if the database has the genesis block, if it
       doesn't then go get it and store it. If this ever says it
       could not collect the genesis block, we've got big problems */
    if (haveGenesis) {
      Logger.info('Genesis block found in database')
      timer.pause = false
    } else {
      return collector.getGenesis()
        .then(genesis => { return database.saveBlock(genesis) })
        .then(() => Logger.info('Collected genesis block'))
        .then(() => { timer.pause = false })
        .catch(error => {
          Logger.error('Could not collect genesis block: %s', error)
          process.exit(0)
        })
    }
  })
  .catch(error => {
    Logger.error('Could not check for genesis block in database: %s', error)
    process.exit(0)
  })

timer.on('tick', () => {
  timer.pause = true // let's not tick again we're ready

  /* We define this here as a method to catch a break in the chained
     promises to allow us to exit the chain without generating an
     error that gets dumped to the screen erroneously */
  function BreakSignal () {}

  var topKnownBlockHash

  /* Let's go grab the transaction hashes that we know about */
  return database.getLastKnownBlockHashes()
    .then(lastKnownHashes => {
      /* We need the top block we know about here to use later */
      if (lastKnownHashes.length !== 0) {
        topKnownBlockHash = lastKnownHashes[0]
      }

      return collector.queryBlocks(lastKnownHashes)
    })
    .then(results => {
      if (results.blocks.length === 1) {
      /* If we only got one block back, then we are already at the top */
        throw new BreakSignal()
      }

      if (results.blocks.length !== 0) {
      /* Grab the first block in the response */
        const block = results.blocks[0]

        /* If the first block hash matches our top known block hash
           we need to discard it from the result to avoid deleting
           it and re-saving it again. We also need to bump our start
           height to avoid deleting the block */
        if (block.hash === topKnownBlockHash) {
          results.blocks.shift()
          results.height++
        }
      }

      /* Try to save what we've collected */
      return database.saveBlocks(results.blocks, results.height)
    })
    .then(results => {
      /* Great, we saved them, let's tell print out some information about
         what we managed to collect */
      for (var i = 0; i < results.blocks.length; i++) {
        Logger.info('Saved block #%s (%s)', results.blocks[i].height, results.blocks[i].hash)
      }

      Logger.info('============   %s Delete Statements  ============', results.deletes)
      Logger.info('============   Stored %s Objects   ============', results.inserts)

      /* Allow our timer to fire again */
      timer.pause = false
    })
    .catch(error => {
      /* If we threw because we exited the promise chain early,
         that's okay and we don't need to log an event */
      if (!(error instanceof BreakSignal)) {
        Logger.error(error.toString())

        if (error.toString().indexOf('refusing to save batches of blocks') !== -1) {
          rewind()
            .then(() => { timer.pause = false })
            .catch(error => {
              Logger.error(error.toString())

              timer.pause = false
            })
        } else {
          timer.pause = false
        }
      } else {
        /* Allow our timer to fire again */
        timer.pause = false
      }
    })
})

/* Let's go grab the transaction pool from the daemon and save
   it in the database */
transactionPoolTimer.on('tick', () => {
  transactionPoolTimer.pause = true
  var transactions

  return collector.getTransactionPool()
    .then(poolTransactions => { transactions = poolTransactions })
    .then(() => { return database.saveTransactionPool(transactions) })
    .then(() => Logger.info('Saved current transaction pool (%s transactions)', transactions.length))
    .then(() => { transactionPoolTimer.pause = false })
    .catch((error) => {
      Logger.warning('Could not save transaction pool [Are you sure you started with the blockexplorer enabled?]: %s', error)
      transactionPoolTimer.pause = false
    })
})

/* Let's go get the daemon information to store in the database */
informationTimer.on('tick', () => {
  informationTimer.pause = true

  return collector.getInfo()
    .then(info => { return database.saveInfo('getinfo', JSON.stringify(info)) })
    .then(() => Logger.info('Saved daemon information'))
    .then(() => { informationTimer.pause = false })
    .catch(error => {
      Logger.warning('Could not save daemon information: %s', error)
      informationTimer.pause = false
    })
})
