# NodeSeek → Seekly · Egern 模块

[![CI](https://github.com/Ethan2258/egern-seekly/actions/workflows/ci.yml/badge.svg)](https://github.com/Ethan2258/egern-seekly/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](./LICENSE)
[![Egern](https://img.shields.io/badge/Egern-module-orange.svg)](https://egernapp.com)

在 Telegram、Safari 等地方点开 NodeSeek 帖子链接（比如 `https://nodeseek.com/post-1038101-1`）时，直接在 [Seekly](https://github.com/maow318/seekly-open)（NodeSeek 第三方 iOS 客户端）里打开这个帖子，不用停在网页上。

```
Telegram 点链接 → Safari 发起请求 → Egern 本地返回 302 → seekly://post/1038101 → Seekly 打开帖子
```

## 安装

**一键安装**（在 iPhone 上点开）：[添加到 Egern](https://egernapp.com/modules/new?name=NodeSeek%20%E2%86%92%20Seekly&url=https%3A%2F%2Fraw.githubusercontent.com%2FEthan2258%2Fegern-seekly%2Fmain%2Fseekly.yaml)

或者在 Egern 里手动添加模块，地址填：

```
https://raw.githubusercontent.com/Ethan2258/egern-seekly/main/seekly.yaml
```

然后：

1. 打开 Egern 的 MITM，安装并信任根证书（设置 → 通用 → 关于本机 → 证书信任设置）。
2. 确认已安装 [Seekly](https://github.com/maow318/seekly-open/releases)，并且 Egern 处于连接状态。
3. 在 Telegram 里点 NodeSeek 帖子链接，选「打开」。Safari 会弹出「在 "Seekly" 中打开此页？」，点「打开」即可。

## 参数

在 Egern 的模块参数里可以改 `MODE`：

| 值 | 效果 |
| --- | --- |
| `redirect`（默认） | 直接返回 302 跳转到 `seekly://post/<id>`，没有中间页。 |
| `page` | 返回一个小跳转页：自动打开 Seekly，同时保留「在 Seekly 中打开」和「继续在浏览器中查看」两个按钮。浏览器拦住跳转时可以手动点。 |

只想在浏览器里看某个帖子，就在链接后面加 `?seekly=0`：

```
https://www.nodeseek.com/post-1038101-1?seekly=0
```

## 常见问题

**为什么还会先闪一下 Safari，并弹出确认框？**
Telegram 会把 `https://` 链接交给系统浏览器；Egern 只能处理网络请求，所以要等 Safari 开始加载页面时才能把它换成跳转。确认框是 iOS 对「网页跳转到其他 App」的安全提示，网页和代理都跳不过去。要真正一步直达，得靠通用链接（Universal Links），而那需要 nodeseek.com 官方授权给 Seekly，第三方客户端做不到。

**会不会影响 Seekly 自己加载帖子？**
不会。Seekly 抓取页面时使用固定的 User-Agent（`iPhone OS 17_0 … Version/17.0`），模块会识别并放行。另外只有浏览器的整页打开（`Sec-Fetch-Dest: document` / `Sec-Fetch-Mode: navigate`，老系统看 `Accept: text/html`）才会跳转，接口请求、预加载和 iframe 都不处理。

**为什么只能跳到帖子开头？**
Seekly 的 URL Scheme 只接收帖子 ID（`seekly://post/<id>`），链接中的页码带不过去。这个格式是从 Seekly 5.2 安装包的 `Info.plist` 和链接处理代码中确认的。

## 已知限制

- 在 Seekly 里选择「用浏览器打开」帖子时，也会被跳回 Seekly，需要的话用 `?seekly=0`。
- 系统正好是 iOS 17.0 时，Safari 的 User-Agent 与 Seekly 相同，不会触发跳转。
- 没装 Seekly 时 iOS 会提示地址无效，在链接后加 `?seekly=0` 再打开即可。
- MITM 只覆盖 `nodeseek.com` 和 `www.nodeseek.com`，不解密其他网站的流量。

## 文件

| 路径 | 说明 |
| --- | --- |
| `seekly.yaml` | Egern 模块 |
| `seekly-open.js` | 请求脚本 |
| `test/`、`scripts/check-module.mjs` | 本地测试与一致性检查（不影响模块本身） |

## 开发

需要 Node.js 22 及以上，没有第三方依赖：

```bash
npm run check   # 脚本语法，seekly.yaml 与脚本、README 是否一致
npm test        # 模拟 Egern 调用脚本：跳转、放行、?seekly=0、page 模式
```

改动走 PR，CI 通过后合并。Egern 直接从 `main` 分支读取模块和脚本，合并后即生效。

## 声明

本项目与 NodeSeek 官方及 Seekly 作者均无关联，只在本机处理链接跳转，不收集任何数据。

## 许可证

[GPL-3.0](./LICENSE)
