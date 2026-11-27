# NodeSeek → Seekly · Egern / Surge / Loon / Stash / 小火箭 模块

[![CI](https://github.com/Ethan2258/egern-seekly/actions/workflows/ci.yml/badge.svg)](https://github.com/Ethan2258/egern-seekly/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](./LICENSE)
[![Egern](https://img.shields.io/badge/Egern-module-orange.svg)](https://egernapp.com)
[![Surge](https://img.shields.io/badge/Surge-module-blue.svg)](https://nssurge.com)
[![Loon](https://img.shields.io/badge/Loon-plugin-green.svg)](https://nsloon.app)
[![Stash](https://img.shields.io/badge/Stash-override-purple.svg)](https://stash.ws)
[![Shadowrocket](https://img.shields.io/badge/Shadowrocket-module-red.svg)](https://apps.apple.com/app/id932747118)

在 Telegram、Safari 等地方点开 NodeSeek 帖子链接（比如 `https://nodeseek.com/post-1038101-1`）时，直接在 [Seekly](https://github.com/maow318/seekly-open)（NodeSeek 第三方 iOS 客户端）里打开这个帖子，不用停在网页上。

```
Telegram 点链接 → Safari 发起请求 → 代理 App 本地返回 302 → seekly://post/1038101 → Seekly 打开帖子
```

## 安装

先选你在用的代理 App。所有版本行为一致：同样的链接匹配、MITM 主机（只有 `nodeseek.com` 和 `www.nodeseek.com`）、对 `nodeseek.com` 拒绝 QUIC 的规则，以及同一份跳转逻辑。

| App | 文件 | 一键安装 | 手动添加的地址 |
| --- | --- | --- | --- |
| Egern | `seekly.yaml` | [添加到 Egern](https://egernapp.com/modules/new?name=NodeSeek%20%E2%86%92%20Seekly&url=https%3A%2F%2Fraw.githubusercontent.com%2FEthan2258%2Fegern-seekly%2Fmain%2Fseekly.yaml) | `https://raw.githubusercontent.com/Ethan2258/egern-seekly/main/seekly.yaml` |
| Loon | `seekly.plugin` | [添加到 Loon](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2FEthan2258%2Fegern-seekly%2Fmain%2Fseekly.plugin) | `https://raw.githubusercontent.com/Ethan2258/egern-seekly/main/seekly.plugin` |
| Surge | `seekly.sgmodule` | 见下方链接 | `https://raw.githubusercontent.com/Ethan2258/egern-seekly/main/seekly.sgmodule` |
| Stash | `seekly.stoverride` | 见下方链接 | `https://raw.githubusercontent.com/Ethan2258/egern-seekly/main/seekly.stoverride` |
| Shadowrocket（小火箭） | `seekly.module` | 见下方链接 | `https://raw.githubusercontent.com/Ethan2258/egern-seekly/main/seekly.module` |

Surge、Stash 和小火箭的一键安装是 App 自己的链接，GitHub 网页上点不了，复制到 Safari 地址栏打开即可：

```
surge:///install-module?url=https%3A%2F%2Fraw.githubusercontent.com%2FEthan2258%2Fegern-seekly%2Fmain%2Fseekly.sgmodule
stash://install-override?url=https%3A%2F%2Fraw.githubusercontent.com%2FEthan2258%2Fegern-seekly%2Fmain%2Fseekly.stoverride
shadowrocket://install?module=https%3A%2F%2Fraw.githubusercontent.com%2FEthan2258%2Fegern-seekly%2Fmain%2Fseekly.module
```

手动添加的位置：

- **Egern**：模块 → 添加模块，填 `seekly.yaml` 的地址。
- **Loon**：配置 → 插件 → 添加插件，填 `seekly.plugin` 的地址（需要 Loon 3.2.1 及以上，才能在插件里选 `MODE`）。
- **Surge**：首页 → 模块 → 安装新模块，填 `seekly.sgmodule` 的地址（需要 Surge 5，`PROTOCOL` 规则和模块参数都依赖它）。
- **Stash**：首页 → 覆写 → 安装覆写，填 `seekly.stoverride` 的地址。
- **小火箭**：配置 → 模块 → 右上角 +，填 `seekly.module` 的地址。

装好之后：

1. 在 App 里打开 MITM（HTTPS 解密），安装并信任根证书（设置 → 通用 → 关于本机 → 证书信任设置）。
2. 确认已安装 [Seekly](https://github.com/maow318/seekly-open/releases)，并且代理处于连接状态。
3. 在 Telegram、Discord 里点 NodeSeek 帖子链接，选「打开」。Safari 会弹出「在 "Seekly" 中打开此页？」，点「打开」即可。

## 参数

可以改 `MODE`：

- **Egern**：模块参数里改 `MODE`。
- **Surge**：模块的参数里改 `MODE`。
- **Loon**：插件设置里的「跳转方式」。
- **Stash、小火箭**：这两个 App 的覆写 / 模块不支持参数，默认 `redirect`。想用 `page`，把文件里的 `argument` 改成 `MODE=page`，保存为本地模块使用。

| 值 | 效果 |
| --- | --- |
| `redirect`（默认） | 直接返回 302 跳转到 `seekly://post/<id>`，没有中间页。请求经过 NodeSeek 的 Service Worker 转发时，302 过不去，会改用跳转页。 |
| `page` | 返回一个小跳转页：自动打开 Seekly，同时保留「在 Seekly 中打开」和「继续在浏览器中查看」两个按钮。浏览器拦住跳转时可以手动点；几秒后还停在这页，会提示重试或下载 Seekly。 |

只想在浏览器里看某个帖子，就在链接后面加 `?seekly=0`：

```
https://www.nodeseek.com/post-1038101-1?seekly=0
```

## 常见问题

**为什么还会先闪一下 Safari，并弹出确认框？**
Telegram 会把 `https://` 链接交给系统浏览器；代理 App 只能处理网络请求，所以要等 Safari 开始加载页面时才能把它换成跳转。确认框是 iOS 对「网页跳转到其他 App」的安全提示，网页和代理都跳不过去。要真正一步直达，得靠通用链接（Universal Links），而那需要 nodeseek.com 官方授权给 Seekly，第三方客户端做不到。

**链接还是直接在网页里打开了，没有跳转？**
先在 App 里刷新模块（插件、覆写），确认用的是最新版本（带有拒绝 QUIC 的规则）。NodeSeek 在 Cloudflare 上，Safari 等浏览器常用 HTTP/3（QUIC）访问它，而 MITM 解不开 QUIC，脚本就收不到请求。模块现在只对 `nodeseek.com` 拒绝 QUIC，浏览器会自动退回普通 HTTPS。之前已经打开过的网页标签不算，要重新点一次链接。还要注意：只有帖子链接（`/post-<ID>`）会跳转，首页、个人空间等其他页面不会。

**以前在 Safari 里打开过 NodeSeek，之后就不跳了？**
NodeSeek 会在浏览器里装一个 Service Worker（`sw.js`）。装好之后，帖子页面的请求要先经过它转发，请求头会变（`Sec-Fetch-Mode` 不再是 `navigate`）。模块会识别这种转发的请求；302 跳转过不了 Service Worker，所以这种情况统一返回跳转页，由页面里的脚本打开 Seekly（会短暂看到「正在打开 Seekly…」）。

**会不会影响 Seekly 自己加载帖子？**
不会。Seekly 抓取页面时使用固定的 User-Agent（`iPhone OS 17_0 … Version/17.0`），模块会识别并放行。另外只有浏览器打开整个页面（`Sec-Fetch-Mode: navigate` 或 `Sec-Fetch-Dest: document`，以及 Service Worker 转发的同一请求；老系统看 `Accept: text/html`）才会跳转，接口请求、预加载、链接预览和 iframe 都不处理。

**为什么只能跳到帖子开头？**
Seekly 的 URL Scheme 只接收帖子 ID（`seekly://post/<id>`），链接中的页码带不过去。这个格式是从 Seekly 5.2 安装包的 `Info.plist` 和链接处理代码中确认的。

## 已知限制

- 在 Seekly 里选择「用浏览器打开」帖子时，也会被跳回 Seekly，需要的话用 `?seekly=0`。
- 系统正好是 iOS 17.0 时，Safari 的 User-Agent 与 Seekly 相同，不会触发跳转。
- 没装 Seekly 时 iOS 会提示地址无效，在链接后加 `?seekly=0` 再打开即可。跳转页（`page` 模式，或经过 Service Worker 的请求）会在几秒后提示去下载 Seekly。
- MITM 只覆盖 `nodeseek.com` 和 `www.nodeseek.com`，不解密其他网站的流量；QUIC 也只对 `nodeseek.com` 拒绝。

## 文件

| 路径 | 说明 |
| --- | --- |
| `seekly.yaml` | Egern 模块 |
| `seekly.sgmodule` | Surge 模块 |
| `seekly.plugin` | Loon 插件 |
| `seekly.stoverride` | Stash 覆写 |
| `seekly.module` | 小火箭模块 |
| `seekly-open.js` | 请求脚本（Egern） |
| `seekly-open.compat.js` | 请求脚本（Surge / Loon / Stash / 小火箭），由 `seekly-open.js` 生成 |
| `scripts/build-compat.mjs` | 生成兼容脚本：原样复制 Egern 的跳转逻辑，外面套一层 `$request` / `$argument` / `$done` 适配 |
| `test/`、`scripts/check-module.mjs` | 本地测试与一致性检查（不影响模块本身） |

## 开发

需要 Node.js 22 及以上，没有第三方依赖：

```bash
npm run build   # 改了 seekly-open.js 之后，重新生成 seekly-open.compat.js
npm run check   # 脚本语法，兼容脚本是否最新，各应用配置与脚本、README 是否一致
npm test        # 分别按 Egern 和 Surge / Loon / Stash / 小火箭的方式调用脚本：跳转、放行、?seekly=0、page 模式、各种参数格式
```

改动走 PR，CI 通过后合并。只改 `seekly-open.js`，不要手改 `seekly-open.compat.js`。各 App 直接从 `main` 分支读取配置和脚本，合并后刷新即可生效。

## 声明

本项目与 NodeSeek 官方及 Seekly 作者均无关联，只在本机处理链接跳转，不收集任何数据。

## 许可证

[GPL-3.0](./LICENSE)
