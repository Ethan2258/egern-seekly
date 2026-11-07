# egern-seekly

一个 [Egern](https://egernapp.com) 模块：在 Telegram、Safari 等地方点开 NodeSeek 帖子链接（比如 `https://nodeseek.com/post-1038101-1`）时，不再进浏览器，而是直接在 [Seekly](https://github.com/maow318/seekly-open)（NodeSeek 的第三方 iOS 客户端）里打开这个帖子。

## 安装

1. 在 Egern 中添加模块，地址填：

   ```
   https://raw.githubusercontent.com/Ethan2258/egern-seekly/main/seekly.yaml
   ```

2. 打开 Egern 的 MITM，安装并信任它的根证书（设置 → 通用 → 关于本机 → 证书信任设置）。
3. 确认 Egern 已连接。之后在 Telegram 里点 NodeSeek 帖子链接、选「打开」，就会跳到 Seekly。第一次跳转时 iOS 会问「是否在 Seekly 中打开」，点「打开」即可。

## 原理

- 模块只对 `nodeseek.com` 和 `www.nodeseek.com` 做 MITM，只匹配 `/post-<帖子ID>[-<页码>]` 这类帖子链接。
- 浏览器打开帖子时，脚本不把请求发给 NodeSeek，而是直接在本地返回响应，把帖子 ID 交给 Seekly 的 URL Scheme：`seekly://post/<帖子ID>`。这个格式是从 Seekly 5.2 安装包里的 `Info.plist` 和链接处理代码中确认的。
- 只有浏览器的整页打开才会跳转（`Sec-Fetch-Dest: document` / `Sec-Fetch-Mode: navigate`；老系统上看 `Accept: text/html`）。接口请求、预加载、iframe 都不处理。
- Seekly App 自己也会请求帖子页面来抓取内容。这些请求带着它内置的固定 User-Agent（`iPhone OS 17_0 … Version/17.0`），模块会识别并放行，App 能照常加载。

## 参数

在 Egern 的模块参数里可以改 `MODE`：

| 值 | 效果 |
| --- | --- |
| `redirect`（默认） | 直接返回 302 跳转到 `seekly://post/<id>`，没有中间页。 |
| `page` | 返回一个小跳转页：自动打开 Seekly，同时保留「在 Seekly 中打开」和「继续在浏览器中查看」两个按钮。Telegram 内置浏览器拦截跳转时，可以手动点按钮。 |

## 想在浏览器里看帖子？

在链接后面加 `?seekly=0`（`page` 模式下跳转页上的「继续在浏览器中查看」按钮就是这么做的），例如：

```
https://www.nodeseek.com/post-1038101-1?seekly=0
```

## 已知限制

- Seekly 的 Scheme 只接收帖子 ID，链接里的页码（`post-ID-页码` 中的页码）不会带过去，进入后会停在帖子开头。
- 在 Seekly 里选择「用 Safari/内置浏览器打开」帖子时，也会被跳回 Seekly。需要的话请用上面的 `?seekly=0`。
- 设备系统正好是 iOS 17.0 时，Safari 的 User-Agent 和 Seekly 的一样，不会触发跳转。
- 需要先装好 Seekly。没装的话，iOS 会提示地址无效，这时在链接后加 `?seekly=0` 再打开即可。

## 文件

- `seekly.yaml`：Egern 模块
- `seekly-open.js`：请求脚本
