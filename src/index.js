const fs = require('fs')
const path = require('path')
const co = require('co')
const colors = require('colors')
const _ = require('lodash')
const glob = require('glob')
const ObsClient = require('esdk-obs-nodejs')

class WeipackHuaweiObs {
  constructor(options) {
    this.config = Object.assign({
      test: false,
      verbose: true,
      dist: '',
      deleteOrigin: false,
      deleteEmptyDir: false,
      timeout: 30 * 1000,
      setObsPath: null,
      setHeaders: null
    }, options)

    this.configErrStr = this.checkOptions(options)
  }

  apply(compiler) {
    if (compiler) {
      this.doWithWebpack(compiler)
    } else {
      this.doWithoutWebpack()
    }
  }

  doWithWebpack(compiler) {
    compiler.hooks.afterEmit.tapPromise('WeipackHuaweiObs', (compilation) => {
      if (this.configErrStr) {
        compilation.errors.push(new Error(this.configErrStr))
        return Promise.resolve()
      }

      const outputPath = compiler.options.output.path
      const { from = outputPath + (outputPath.endsWith(path.sep) ? '' : path.sep) + '**', verbose } = this.config

      const files = this.getFiles(from)
      if (files.length) return this.upload(files, true, outputPath)
      else {
        verbose && console.log('no files to upload')
        return Promise.resolve()
      }
    })
  }

  doWithoutWebpack() {
    if (this.configErrStr) return Promise.reject(new Error(this.configErrStr))
    const { from, verbose } = this.config
    const files = this.getFiles(from)
    if (files.length) return this.upload(files)
    else {
      verbose && console.log('no files to upload')
      return Promise.resolve()
    }
  }

  upload(files, inWebpack, outputPath = '') {
    const {
      dist,
      setHeaders,
      deleteOrigin,
      deleteEmptyDir,
      setObsPath,
      timeout,
      verbose,
      test,
      server, ak, sk, bucket
    } = this.config

    const client = new ObsClient({
      access_key_id: ak,
      secret_access_key: sk,
      server
    })

    return new Promise((resolve, reject) => {
      const o = this
      const splitToken = inWebpack ? path.sep + outputPath.split(path.sep).pop() + path.sep : ''

      co(function* () {
        let filePath, i = 0, len = files.length
        while (i++ < len) {
          filePath = files.shift()

          let obsFilePath = (
            dist +
            (
              (setObsPath && setObsPath(filePath)) ||
              (inWebpack && splitToken && filePath.split(splitToken)[1]) ||
              ''
            )
          ).replace(/\\/g, '/').replace(/\/\/+/g, '/')
          if (test) {
            console.log(filePath.gray, '\nis ready to upload to '.green + obsFilePath)
            continue
          }
          const result = yield client.putObject({
            Bucket: bucket,
            Key: obsFilePath,
            SourceFile: filePath,
          })

          if (result.CommonMsg.Status < 300) {
            verbose && console.log(filePath.gray, '\nupload to '.green + obsFilePath + ' success,'.green)
          } else {
            console.log('failed: '.red, result.CommonMsg)
          }

          if (deleteOrigin) {
            fs.unlinkSync(filePath)
            if (deleteEmptyDir && files.every(f => f.indexOf(path.dirname(filePath)) === -1))
              o.deleteEmptyDir(filePath)
          }
        }
      }).then(resolve, err => {
        console.log('upload failed'.red, err)
        reject(err)
      })
    })
  }

  getFiles(exp) {
    const _getFiles = function (exp) {
      if (!exp || !exp.length) return []
      exp = exp[0] === '!' && exp.substr(1) || exp
      return glob.sync(exp, { nodir: true }).map(file => path.resolve(file))
    }

    return Array.isArray(exp)
      ? exp.reduce((prev, next) => {
          return next[0] === '!' ? _.without(prev, ..._getFiles(next)) : _.union(prev, _getFiles(next))
        }, _getFiles(exp[0]))
      : _getFiles(exp)
  }

  deleteEmptyDir(filePath) {
    const dirname = path.dirname(filePath)
    if (fs.existsSync(dirname) && fs.statSync(dirname).isDirectory()) {
      fs.readdir(dirname, (err, files) => {
        if (err) console.error(err)
        else if (!files.length) {
          fs.rmdir(dirname, () => {
            this.config.verbose && console.log('empty directory deleted'.green, dirname)
          })
        }
      })
    }
  }

  checkOptions(options = {}) {
    const { from, server, ak, sk, bucket } = options
    let errStr = ''
    if (!server) errStr += '\nserver not specified'
    if (!ak) errStr += '\nak (access_key_id) not specified'
    if (!sk) errStr += '\nsk (secret_access_key) not specified'
    if (!bucket) errStr += '\nbucket not specified'
    if (Array.isArray(from)) {
      if (from.some(g => typeof g !== 'string')) errStr += '\neach item in from should be a glob string'
    } else {
      let fromType = typeof from
      if (!['undefined', 'string'].includes(fromType)) errStr += '\nfrom should be string or array'
    }
    return errStr
  }
}

module.exports = WeipackHuaweiObs
