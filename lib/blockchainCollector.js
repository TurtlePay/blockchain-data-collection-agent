// Copyright (c) 2018, TurtlePay Developers
//
// Please see the included LICENSE file for more information.

/* eslint no-async-promise-executor: 0 */

'use strict'

const Client = require('turtlecoin-rpc').Client
const TurtleCoind = require('turtlecoin-rpc').TurtleCoind
const inherits = require('util').inherits
const EventEmitter = require('events').EventEmitter
const util = require('util')

const Self = function (opts) {
  opts = opts || {}
  if (!(this instanceof Self)) return new Self(opts)

  opts.host = opts.host || '127.0.0.1'
  opts.port = opts.port || 11898
  opts.timeout = opts.timeout || 2000
  opts.ssl = opts.ssl || false
  this.rpc = new Client(opts)
  this.daemon = new TurtleCoind(opts)
  this.blocks = opts.blocks || 1000
}
inherits(Self, EventEmitter)

Self.prototype.getGenesis = function () {
  return new Promise((resolve, reject) => {
    this.emit('debug', 'Attempting to retrieve the genesis block from the daemon...')
    this.rpc.getBlockDetailsByHeight({ blockHeight: '0' }).then((result) => {
      if (result.status === 'OK') {
        return resolve(result.block)
      } else {
        return reject(new Error(result.status))
      }
    }).catch((error) => {
      return reject(error)
    })
  })
}

Self.prototype.queryBlocks = function (blockHashes) {
  return new Promise(async (resolve, reject) => {
    var blockCount = ++this.blocks
    var error

    while (blockCount >= 2) {
      this.emit('debug', util.format('Attempting to retrieve %s blocks...', blockCount))
      try {
        var results = await this.rpc.queryBlocksDetailed({ blockHashes: blockHashes, blockCount: blockCount })
        if (results.status === 'OK') {
          return resolve({ blocks: results.blocks, height: (results.startHeight) })
        } else {
          throw new Error('Received invalid response from daemon')
        }
      } catch (e) {
        this.emit('debug', util.format('Failed to retrieve %s blocks', blockCount))
        blockCount = Math.floor(blockCount / 2)
        error = e
      }
    }

    return reject(new Error('queryBlocksDetailed failed: ' + error.message))
  })
}

Self.prototype.getTransactionPool = function () {
  return new Promise((resolve, reject) => {
    this.emit('debug', 'Attempting to retrieve the current transaction pool...')
    this.daemon.getTransactionPool().then((result) => {
      return resolve(result)
    }).catch((error) => {
      return reject(new Error('Could not collected transaction pool from daemon: ' + error.message))
    })
  })
}

Self.prototype.getInfo = function () {
  return new Promise((resolve, reject) => {
    this.emit('debug', 'Attempting to retrieve the current daemon information...')
    this.daemon.info().then((result) => {
      return resolve(result)
    }).catch((error) => {
      return reject(new Error('Could not collect daemon information from daemon: ' + error.message))
    })
  })
}

module.exports = Self
