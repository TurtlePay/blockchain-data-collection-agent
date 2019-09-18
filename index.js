// Copyright (c) 2018-2019, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

require('dotenv').config()
const BlockChainCollector = require('./lib/blockchainCollector')
const DatabaseBackend = require('./lib/databaseBackend')
const Metronome = require('./lib/metronome')
const util = require('util')

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
    port: process.env.NODE_PORT || 11898,
    blocks: process.env.NODE_BLOCKS || 1000,
    timeout: process.env.NODE_TIMEOUT || 12000
  },
  storeRawTransactionExtra: process.env.STORE_RAW_TRANSACTION_EXTRA || false
}

/* Let's set up a standard logger. Sure it looks cheap but it's
   reliable and won't crash */
function log (message) {
  console.log(util.format('%s: %s', (new Date()).toUTCString(), message))
}

/* Sanity check to make sure we have connection information
   for the database and node */
if (!env.mysql.host || !env.mysql.port || !env.mysql.username || !env.mysql.password || !env.mysql.database || !env.node.host || !env.node.port || !env.node.blocks) {
  log('It looks like you did not export all of the required connection information into your environment variables before attempting to start the service.')
  process.exit(0)
}

/* We're going to go ahead and create our timer but pause it until
   we know that we have the genesis hash in the database */
const timer = new Metronome(2000)
timer.pause = true

/* Timer to fire to get the transaction pool information */
const transactionPoolTimer = new Metronome(5000)

/* Timer to fire to get the network information */
const informationTimer = new Metronome(5000)

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
  blocks: env.node.blocks,
  timeout: env.node.timeout
})

if (env.enableDebugging) {
  collector.on('debug', (message) => {
    log(util.format('[DEBUG] %s', message))
  })
}

database.haveGenesis().then((haveGenesis) => {
  /* Check to see if the database has the genesis block, if it
     doesn't then go get it and store it. If this ever says it
     could not collect the genesis block, we've got big problems */
  if (haveGenesis) {
    log('[INFO] Genesis block found in database')
    timer.pause = false
  } else {
    collector.getGenesis().then((genesis) => {
      return database.saveBlock(genesis)
    }).then(() => {
      log('[INFO] Collected genesis block')
      timer.pause = false
    }).catch((error) => {
      log('[ERROR] Could not collect genesis block: ' + error)
    })
  }
}).catch(() => {
  log('[ERROR] Could not check for genesis block in database')
})

timer.on('tick', () => {
  timer.pause = true // let's not tick again we're ready

  /* We define this here as a method to catch a break in the chained
     promises to allow us to exit the chain without generating an
     error that gets dumped to the screen erroneously */
  function BreakSignal () {}

  var topKnownBlockHash

  /* Let's go grab the transaction hashes that we know about */
  database.getLastKnownBlockHashes().then((lastKnownHashes) => {
    /* We need the top block we know about here to use later */
    if (lastKnownHashes.length !== 0) {
      topKnownBlockHash = lastKnownHashes[0]
    }
    return collector.queryBlocks(lastKnownHashes)
  }).then((results) => {
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
  }).then((results) => {
    /* Great, we saved them, let's tell print out some information about
       what we managed to collect */
    for (var i = 0; i < results.blocks.length; i++) {
      log('[INFO] Saved block #' + results.blocks[i].height + ' (' + results.blocks[i].hash + ')')
    }
    log('[INFO] ============   ' + results.deletes + ' Delete Statements  ============')
    log('[INFO] ============   Stored ' + results.inserts + ' Objects   ============')

    /* Allow our timer to fire again */
    timer.pause = false
  }).catch((error) => {
    /* If we threw because we exited the promise chain early,
       that's okay and we don't need to log an event */
    if (!(error instanceof BreakSignal)) {
      log('[ERROR] ' + error)
    }

    /* Allow our timer to fire again */
    timer.pause = false
  })
})

/* Let's go grab the transaction pool from the daemon and save
   it in the database */
transactionPoolTimer.on('tick', () => {
  transactionPoolTimer.pause = true
  var txnCount
  collector.getTransactionPool().then((transactions) => {
    txnCount = transactions.length
    return database.saveTransactionPool(transactions)
  }).then(() => {
    log('[INFO] Saved current transaction pool (' + txnCount + ' transactions)')
    transactionPoolTimer.pause = false
  }).catch((error) => {
    log('[WARN] Could not save transaction pool [Are you sure you started with the blockexplorer enabled?]: ' + error)
    transactionPoolTimer.pause = false
  })
})

/* Let's go get the daemon information to store in the database */
informationTimer.on('tick', () => {
  informationTimer.pause = true
  collector.getInfo().then((info) => {
    return database.saveInfo('getinfo', JSON.stringify(info))
  }).then(() => {
    log('[INFO] Saved daemon information')
    informationTimer.pause = false
  }).catch((error) => {
    log('[WARN] Could not save daemon information: ' + error)
    informationTimer.pause = false
  })
})
