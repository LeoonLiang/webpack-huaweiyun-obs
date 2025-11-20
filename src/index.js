const fs = require('fs')
const path = require('path')
const { glob } = require('glob')
const _pLimit = require('p-limit')
const pLimit = _pLimit.default || _pLimit
const ObsClient = require('esdk-obs-nodejs')

class WebpackHuaweiObs {
  constructor(options = {}) {
    this.config = Object.assign(
      {
        test: false,
        verbose: true,
        dist: '',
        deleteOrigin: false,
        deleteEmptyDir: false,
        timeout: 30 * 1000,
        setObsPath: null,
        setHeaders: null,
        concurrency: 5, // 并发上传数量
      },
      options
    )

    this.configErrStr = this.checkOptions(this.config)
  }

   apply(compiler) {
    if (
      !compiler ||
      typeof compiler !== 'object' ||
      !compiler.hooks ||
      compiler.constructor?.name !== 'Compiler'
    ) {
      console.error('[WebpackHuaweiObs] Error: This plugin can only run inside Webpack.')
      return
    }

    compiler.hooks.afterEmit.tapPromise('WebpackHuaweiObs', async (compilation) => {
      if (this.configErrStr) {
        compilation.errors.push(new Error(this.configErrStr))
        return
      }

      const outputPath = compiler.options.output.path
      const from =
        this.config.from ||
        path.join(outputPath, '**')
      const files = await this.getFiles(from)

      if (!files.length) {
        this.config.verbose && console.log('[WebpackHuaweiObs] No files to upload.')
        return
      }

      console.log(`[WebpackHuaweiObs] Found ${files.length} files to upload.`)
      await this.upload(files, true, outputPath)
    })
  }

  async doWidthoutWebpack() {
    if (this.configErrStr) {
      throw new Error(this.configErrStr)
    }

    const { from, verbose } = this.config

    const files = await this.getFiles(from)

    if (!files.length) {
      verbose && console.log('[WebpackHuaweiObs] No files to upload.')
      return
    }

    console.log(`[WebpackHuaweiObs] Found ${files.length} files to upload.`)

    await this.upload(files, false)

    console.log('[WebpackHuaweiObs] Upload finished.')

    return true
  }

  async upload(files, inWebpack, outputPath = '') {
    const {
      dist,
      setHeaders,
      deleteOrigin,
      deleteEmptyDir,
      setObsPath,
      test,
      verbose,
      concurrency,
      server,
      ak,
      sk,
      bucket,
    } = this.config

    const client = new ObsClient({
      access_key_id: ak,
      secret_access_key: sk,
      server,
    })

    const splitToken = inWebpack ? path.sep + outputPath.split(path.sep).pop() + path.sep : ''
    const limit = pLimit(concurrency)

    const tasks = files.map((filePath) =>
      limit(async () => {
        const obsFilePath = (
          dist +
          ((setObsPath && setObsPath(filePath)) ||
            (inWebpack && splitToken && filePath.split(splitToken)[1]) ||
            '')
        )
          .replace(/\\/g, '/')
          .replace(/\/\/+/g, '/')
        if (test) {
          console.log(`[TEST] ${filePath} -> ${obsFilePath}`)
          return
        }

        const result = await client.putObject({
          Bucket: bucket,
          Key: obsFilePath,
          SourceFile: filePath,
          ...(setHeaders ? { Headers: setHeaders(filePath) } : {}),
        })

        if (result.CommonMsg.Status < 300) {
          verbose && console.log(`[OK] ${filePath} -> ${obsFilePath}`)
        } else {
          console.error(`[FAIL] ${filePath}`, result.CommonMsg)
        }

        if (deleteOrigin) {
          try {
            await fs.promises.unlink(filePath)
            if (deleteEmptyDir) await this.deleteEmptyDir(filePath)
          } catch (err) {
            console.warn(`[WARN] delete file failed: ${filePath}`, err.message)
          }
        }
      })
    )

    try {
      await Promise.all(tasks)
      verbose && console.log(`[WebpackHuaweiObs] All uploads complete.`)
    } catch (err) {
      console.error(`[WebpackHuaweiObs] Upload failed:`, err)
      throw err
    }
  }


  async getFiles(exp) {
    const _getFiles = async (pattern) => {
      if (!pattern || !pattern.length) return []
      const positive = pattern[0] === '!' ? pattern.substr(1) : pattern
      const matched = await glob(positive, { nodir: true })
      return matched.map((file) => path.resolve(file))
    }

    if (Array.isArray(exp)) {
      let include = await _getFiles(exp[0])
      for (const next of exp.slice(1)) {
        const nextFiles = await _getFiles(next)
        if (next.startsWith('!')) {
          include = include.filter((f) => !nextFiles.includes(f))
        } else {
          include = Array.from(new Set([...include, ...nextFiles]))
        }
      }
      return include
    } else {
      return await _getFiles(exp)
    }
  }

  /** 删除空目录 */
  async deleteEmptyDir(filePath) {
    const dirname = path.dirname(filePath)
    try {
      const files = await fs.promises.readdir(dirname)
      if (!files.length) {
        await fs.promises.rmdir(dirname)
        this.config.verbose && console.log(`[Removed empty dir] ${dirname}`)
      }
    } catch (_) {}
  }


  checkOptions(options = {}) {
    const { from, server, ak, sk, bucket } = options
    let errStr = ''
    if (!server) errStr += '\nserver not specified'
    if (!ak) errStr += '\nak (access_key_id) not specified'
    if (!sk) errStr += '\nsk (secret_access_key) not specified'
    if (!bucket) errStr += '\nbucket not specified'
    if (Array.isArray(from)) {
      if (from.some((g) => typeof g !== 'string')) errStr += '\neach item in from should be a glob string'
    } else {
      const fromType = typeof from
      if (!['undefined', 'string'].includes(fromType)) errStr += '\nfrom should be string or array'
    }
    return errStr
  }
}

module.exports = WebpackHuaweiObs
