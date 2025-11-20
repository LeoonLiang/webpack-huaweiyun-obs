# webpack-huaweiyun-obs

> 🌩 一个用于 Webpack 4+ 的插件，在打包完成后自动将构建产物上传到 **华为云 OBS（对象存储服务）**  

---


## 📦 插件简介

`webpack-huaweiyun-obs` 是一个 Webpack 插件，能在 `build` 完成后自动把编译输出目录（如 JS / CSS / 图片等）上传到 **华为云 OBS**。

---

## 🚀 安装

```bash
npm install webpack-huaweiyun-obs --save-dev
```

## ⚙️ 使用示例
在你的 webpack.config.js 中加入：
```javascript
const WebpackHuaweiObs = require('webpack-huaweiyun-obs')

module.exports = {
  // ...
  plugins: [
    new WebpackHuaweiObs({
      server: 'https://obs.cn-south-1.myhuaweicloud.com', // 华为云 OBS 访问域名（endpoint）
      ak: '你的AccessKeyId',
      sk: '你的SecretAccessKey',
      bucket: '你的Bucket名称',
      from: 'dist/**',        // 上传文件来源，支持glob
      dist: 'webapp/',        // 上传到 OBS 的路径前缀
      verbose: true,          // 是否打印上传日志
      deleteOrigin: false,    // 上传后是否删除本地文件
      deleteEmptyDir: false,  // 是否删除空目录
      test: false             // 测试模式（不真正上传）
    })
  ]
}

```

## 🧠 参数说明
| 参数名                    | 类型                  | 是否必填 | 说明                                                             |
| :--------------------- | :------------------ | :--- | :------------------------------------------------------------- |
| `server`               | `string`            | ✅    | 华为云 OBS endpoint，例如 `https://obs.cn-south-1.myhuaweicloud.com` |
| `ak`                   | `string`            | ✅    | Access Key ID                                                  |
| `sk`                   | `string`            | ✅    | Secret Access Key                                              |
| `bucket`               | `string`            | ✅    | Bucket 名称                                                      |
| `from`                 | `string / string[]` |      | 要上传的文件路径（glob 语法）。默认为output.path下所有的文件                                              |
| `dist`                 | `string`            |      | 上传到 OBS 的路径前缀（默认根目录）。                                             |
| `verbose`              | `boolean`           |      | 是否打印详细上传日志，默认 `true`                                           |
| `deleteOrigin`         | `boolean`           |      | 上传成功后是否删除本地文件                                                  |
| `deleteEmptyDir`       | `boolean`           |      | 删除空目录                                                          |
| `test`                 | `boolean`           |      | 测试模式，只打印上传路径，不真正上传                                             |
| `setObsPath(filePath)` | `function`          |      | 自定义 OBS 路径映射                                                   |
| `setHeaders(filePath)` | `function`          |      | 自定义 HTTP header（例如缓存控制）                                        |

## 来源与改写说明
- 本插件基于 [webpack-aliyun-oss](https://www.npmjs.com/package/webpack-aliyun-oss) 改写，适配华为云生态。
- 区别于 webpack-aliyun-oss，在 webpack 外需要单独调用 doWidthoutWebpack
- 并发上传

