// Copyright (c) 2018-2019, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const TurtleCoind = require('turtlecoin-rpc').TurtleCoind
const EventEmitter = require('events').EventEmitter
const util = require('util')

class Collector extends EventEmitter {
  constructor (opts) {
    super()
    opts = opts || {}

    opts.host = opts.host || '127.0.0.1'
    opts.port = opts.port || 11898
    opts.timeout = opts.timeout || 2000
    opts.ssl = opts.ssl || false
    this.daemon = new TurtleCoind(opts)
  }

  getGenesis () {
    this.emit('debug', 'Attempting to retrieve the genesis block from the daemon...')
    return this.daemon.blocksDetailed({ blockHashes: [], timestamp: 0, blockCount: 1 })
      .then(result => {
        if (result.status.toUpperCase() === 'OK') {
          if (Array.isArray(result.blocks) && result.blocks.length === 2 && result.blocks[0].index === 0) {
            return result.blocks[0]
          } else {
            throw new Error('Daemon returned an unexpected data payload')
          }
        } else {
          throw new Error('Received invalid response from daemon')
        }
      })
  }

  queryBlocks (blockHashes) {
    return new Promise((resolve, reject) => {
      const that = this
      var blockCount = 10

      function tryFetch () {
        return that.daemon.blocksDetailed({ blockHashes: blockHashes, blockCount: blockCount })
          .then(results => {
            if (results.status.toUpperCase() === 'OK') {
              return { blocks: results.blocks, height: (results.startHeight) }
            } else {
              throw new Error('Received invalid response from daemon')
            }
          })
      }

      (async function () {
        var error

        while (blockCount >= 2) {
          try {
            const blocks = await tryFetch()
            return resolve(blocks)
          } catch (e) {
            that.emit('debug', util.format('Failed to retrieve %s blocks', blockCount))
            blockCount = Math.floor(blockCount / 2)
            error = e
          }
        }

        return reject(new Error('queryBlocksDetailed failed: ' + error.toString()))
      })()
    })
  }

  getTransactionPool () {
    this.emit('debug', 'Attempting to retrieve the current transaction pool...')

    return this.daemon.transactionPool()
      .catch(error => { throw new Error('Could not collect transaction pool from daemon: ' + error.message) })
  }

  getInfo () {
    this.emit('debug', 'Attempting to retrieve the current daemon information...')

    return this.daemon.info()
      .catch(error => { throw new Error('Could not collect daemon information from daemon: ' + error.message) })
  }
}

module.exports = Collector
