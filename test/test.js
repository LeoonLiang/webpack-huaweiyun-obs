const WeipackHuaweiObs = require('../dist')
const path = require('path')

const plugin = new WeipackHuaweiObs({
  server: 'https://obs.cn-south-1.myhuaweicloud.com',
  ak: '',
  sk: '',
  bucket: 'leoon',
  dist: '',
  test: true
})

plugin.apply() // 手动调用上传逻辑
