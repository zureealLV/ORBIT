# ORBIT · osu! 网页读谱工具

**输入谱面 ID，先看完整张谱面，再进游戏。**

[简体中文](README.md) · [English](README_EN.md) · [技术博客](https://zureeallv.com/posts/orbit-osu-web-beatmap-reader/) · [功能与验证记录](docs/VALIDATION.md)

ORBIT 是独立实现的 **osu!standard 整谱 Auto 预览工具**。支持 ID / 官网链接搜索、封面信息预览、本地 `.osz` 导入、游戏皮肤、背景视频和常用故事板视觉效果。**界面默认中文，目前是本地运行版本，不是已上线的公共预览服务。**

> 这是读谱工具，不是网页 osu! 客户端：不接收真实游玩判定，不生成成绩、回放、PP 或本地重算星级。48 项 MOD 目录也不等于 48 项完整兼容。

## 实际界面

![ORBIT：单列谱面集搜索、封面信息与真实故事板画面](docs/images/orbit-workspace.jpg)

同一谱面集只展示一张卡片，汇总难度数量和星级范围；输入具体难度 ID 时，保留对应难度作为载入目标。上图是实际浏览器运行截图，不是设计稿。

<details>
<summary>背景视频与 MOD 目录截图</summary>

![背景视频播放后暂停的真实画面](docs/images/orbit-video.jpg)

![明确标注实现状态的 stable + lazer MOD 目录](docs/images/orbit-mods.png)

</details>

## 能做什么

| 能力 | 当前实现 |
| --- | --- |
| 搜索与封面 | 输入数字或官网链接，停顿约 350ms 自动查询；单列、按谱面集去重、展开/淡入动画 |
| 整谱读谱 | 圆圈、L/B/P/C 滑条、反复、转盘、Combo 配色与近似堆叠，自写 Auto 轨迹 |
| 练习控制 | 密度时间轴、拖动跳转、A/B 循环、0.5–2× 练习倍率、全屏入口 |
| 游戏皮肤 | 本地 `.osk` 的游玩贴图、数字、Combo 配色、光标、部分动画与打击音；可切回简约矢量 |
| 视频与故事板 | 原生视频跟随音乐时钟；解析 `.osu` 内联和共享 `.osb`，支持常用视觉命令、缓动与循环 |
| MOD | stable + lazer 共 48 项目录：8 项预览接入、21 项近似效果、14 项说明、5 项不可用 |
| 本地文件 | 浏览器 Worker 解包 `.osz` / `.osk`，本地导入不上传 |

搜索是**完整 ID 匹配**，不是全库数字前缀搜索。星级来自镜像元数据，精确难度的 AR / CS / OD 在载入后的设置区查看。多个不同谱面集碰巧共用查询数字时，仍分别展示。

## 快速启动

需要 **Node.js 22.12+**；本机验证版本 **24.15.0**。浏览器需支持 Canvas 2D、Web Workers、Web Audio；不要求 WebGPU。

```bash
git clone https://github.com/zureealLV/ORBIT.git
cd ORBIT
npm ci
npm run build
npm start
```

打开 **http://127.0.0.1:4173**。Windows 也可双击 **启动 ORBIT.cmd**：缺依赖/构建时自动准备，后台隐藏启动服务器，复用已有实例；日志与 PID 保存在 `.cache/`，不安装系统服务。

1. 输入 `738063`（No title 的单难度 ID）、`320118`（对应谱面集）或官网链接。
2. 选择封面卡片，或按 Enter 载入精确匹配 / 首个候选。
3. 点击播放；载入后通过「读谱」切换同集难度、倍率和 MOD。
4. 在「声画」切换视频/故事板、背景暗化和音量；时间轴支持暂停跳转。
5. 点击「导入 .osz」或拖入文件；皮肤可在「皮肤」页签点击 ＋ 导入。

快捷键：`Space` 播放/暂停，`←` / `→` 跳转五秒，`F` 全屏，`[` / `]` 标记循环起止。输入框聚焦时不会抢快捷键。

**仓库不附带截图里的第三方皮肤。** 新机器没有本地默认皮肤时会使用矢量外观，可自行导入有权使用的 `.osk`；也可安装为本机默认：

```bash
npx tsx scripts/install-local-skin.ts "/absolute/path/to/skin.osk"
```

## 实现路线

```text
输入 ID / 官网链接 ──→ Node 本机资源层 ──→ 元数据 / 封面 / 完整谱面包
本地 .osz ──────────────────────────┐             │
                                    ▼             ▼
                              Web Worker + fflate
                         解包 / .osu 解析 / 滑条几何 / OSB
                                    │
                        音乐主时钟 + 自写 Auto 轨迹
                                    │
                Canvas 2D 游玩渲染 + 原生视频 + 故事板合成
```

谱面解析、滑条几何、堆叠、Auto 轨迹、渲染与音效调度都在本仓库中，**没有嵌入第三方预览播放器或 Rust/WASM 引擎**。ZIP 使用 `fflate`。Worker 避免主线程承担解包与几何计算；故事板按需解码，贴图/染色/滑条缓存均有上限。这不是“比游戏更快”的性能承诺。

## 已知边界

- 仅 osu!standard；不支持 Taiko / Catch / Mania、真实判定、成绩或回放。
- 皮肤覆盖游玩素材子集，不包含完整客户端菜单/HUD/结算皮肤；不保证 stable/lazer 逐像素或听感一致。
- 故事板暂不支持条件 `T` 触发器、`Sample` 音频、负时间片头；视频依赖浏览器编码支持，没有转码服务。
- Auto、部分 MOD 与视觉效果为近似预览；无法实现的项明确禁用。见 [MOD 覆盖矩阵](docs/MODS.md)。
- 服务器仅监听 `127.0.0.1`，复制的预览链接只在同机可用。**不要直接将当前服务器暴露到公网**；正式上线还需鉴权/限流、缓存策略、监控与合规评估。

## 资源与隐私

- 搜索使用 Sayobot 公共元数据；封面由 osu! assets 提供。
- 点选后读取 osu! 官方 `.osu` 以核对难度，再从 Sayobot 下载完整包，Nerinyan 备用。镜像可用性与更新速度不保证。
- 在线谱面缓存在 `.cache/beatmaps/`，上限 512MB；压缩包上限 128MB，解压内容上限 384MB / 4,096 项。完整视频包也受此限制，不会静默退回 novideo 包。
- 无内嵌 ID 的旧谱使用公共映射和官方文件 SHA-256 绑定，不靠曲名猜难度。
- 无账号登录、OAuth 或 API 密钥要求；本地导入只在浏览器内存解析，不会上传。
- 不上传/分发第三方谱面包、皮肤原包、本机缓存或访问凭据。音乐、美术、视频与皮肤版权归原作者。

## 开发与验证

```bash
npm run dev    # 开发服务器
npm test       # 当前 65 项自动化测试
npm run build # TypeScript 检查 + Vite 构建
```

当前实测：Windows 10 / Edge，65 项测试和构建通过；Hexen Noir 的 9,493 个故事板精灵、538 张素材与 MP4 已在真实浏览器核验。测试数量不代表完整游戏兼容，也不代表生产压测通过。GitHub CI 在 Windows / Linux 上运行测试与构建；浏览器媒体兼容另行验收。

- [架构与取舍](docs/ARCHITECTURE.md)
- [视频 / 故事板支持范围](docs/MEDIA.md)
- [皮肤支持范围](docs/SKINS.md)
- [验证记录与未验收项](docs/VALIDATION.md)
- [截图与素材署名](docs/images/README.md)

## 许可与声明

原创代码采用 [MIT](LICENSE) 许可。第三方依赖遵循各自许可，截图中第三方素材不因此获得 MIT 授权。ORBIT 是独立社区工具，与 osu! / ppy 官方无隶属关系。
