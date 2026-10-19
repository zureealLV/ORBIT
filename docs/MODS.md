# Stable + lazer MOD coverage — osu!standard

Catalogue checked on 2026-10-19 against the [official standard ruleset](https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Osu/OsuRuleset.cs), [stable wiki](https://osu.ppy.sh/wiki/en/Gameplay/Game_modifier) and [lazer wiki](https://osu.ppy.sh/wiki/en/Gameplay/Game_modifier_(lazer)). This is a snapshot, not a future-proof claim. No other rulesets are included.

**48 catalogue entries are NOT 48 fully compatible implementations.** 8 preview-connected, 21 approximate, 14 explanation-only, 5 unavailable. Explanation-only selections do not change Auto or create scores. Unavailable buttons cannot be enabled, including from shared URLs.

| Code | Name | Status | Exact boundary |
|---|---|---|---|
| EZ | Easy | Preview connected | AR / CS / OD / HP 减半。 |
| NF | No Fail | Explanation only | 不失败；Auto 预览本身没有失败，未实现手动判定。 |
| HT | Half Time | Preview connected | 0.75×，保持音高；与 DT / NC / DC 互斥。 |
| DC | Daycore | Preview connected | 0.75×，随速度降低音乐音高。 |
| HR | Hard Rock | Preview connected | 难度提升与纵向翻转；与 EZ / MR 互斥。 |
| SD | Sudden Death | Explanation only | MISS 后失败；Auto 全中场景无触发条件，未实现判定。 |
| PF | Perfect | Explanation only | 非满分后重开；Auto 全中场景无触发条件，未实现判定。 |
| DT | Double Time | Preview connected | 1.5×，保持音高，显示等效 AR / OD / BPM。 |
| NC | Nightcore | Approximate preview | 1.5× 升调 + 合成节拍鼓；不使用游戏原始鼓音。 |
| HD | Hidden | Approximate preview | 圆圈提前淡出、隐藏缩圈；滑条轨道单独淡出。 |
| TC | Traceable | Approximate preview | 隐藏圈体和数字，保留缩圈与滑条轮廓。 |
| FL | Flashlight | Approximate preview | 延迟跟随 Auto 光标的手电筒，按 Auto 连击缩小。 |
| BL | Blinds | Approximate preview | 左右遮挡；按设置中的预览 HP 模拟，非真实血量。 |
| ST | Strict Tracking | Explanation only | 滑条跟随判定更严格；Auto 始终跟随，不模拟失误。 |
| AC | Accuracy Challenge | Explanation only | 要求指定准确率；没有真实判定，不模拟失败。 |
| DA | Difficulty Adjust | Preview connected | 独立设置 AR / CS / OD / HP。 |
| CL | Classic | Explanation only | 经典判定 / note lock / HP；未实现手动计分。 |
| RD | Random | Unavailable | 尚未移植官方角度、分段和滑条保形转谱，禁用而非随机乱撒点。 |
| MR | Mirror | Preview connected | 水平 / 垂直 / 双轴镜像，包含堆叠、滑条和 Auto。 |
| AL | Alternate | Explanation only | 强制交替按键；当前没有玩家按键判定。 |
| SG | Single Tap | Explanation only | 强制单键；当前没有玩家按键判定。 |
| TP | Target Practice | Unavailable | 会重建整张目标训练谱；尚未移植，不能用画靶圈冒充。 |
| AT | Autoplay | Explanation only | 本工具始终为 Auto 演示，不是可交互的 AT 成绩。 |
| CN / CM | Cinema | Preview connected | stable 称 CM：隐藏物件和光标、背景不暗化；故事板 / 视频尚不渲染。 |
| RX | Relax | Explanation only | 自动点击但需玩家移动；本工具不提供手动移动判定。 |
| AP | Autopilot | Explanation only | 自动移动但需玩家按键；本工具不提供手动按键判定。 |
| SO | Spun Out | Explanation only | 自动转盘；Auto 预览已自动旋转，不模拟计分惩罚。 |
| TR | Transform | Approximate preview | 物件从旋转偏移处移动到目标，确定性视觉近似。 |
| WG | Wiggle | Approximate preview | 100 ms 随机小幅抖动；使用自有确定性随机函数。 |
| SI | Spin In | Approximate preview | 旋转 / 压扁入场并隐藏缩圈。 |
| GR | Grow | Approximate preview | 物件从 0.5× 放大到正常大小。 |
| DF | Deflate | Approximate preview | 物件从 2× 缩小到正常大小。 |
| WU | Wind Up | Approximate preview | 从 1× 到 1.5× 逐渐加速；显示当前等效难度。 |
| WD | Wind Down | Approximate preview | 从 1× 到 0.75× 逐渐减速。 |
| BR | Barrel Roll | Approximate preview | 游戏区域和 Auto 光标持续旋转；数字朝向为近似。 |
| AD | Approach Different | Approximate preview | 默认 Gravity 风格非线性缩圈；未覆盖所有动画参数。 |
| MU | Muted | Approximate preview | 音乐随 Auto 连击淡出；打击音仍保留。 |
| NS | No Scope | Approximate preview | 达到 10 连击隐藏光标；休息 / 转盘显示。 |
| MG | Magnetised | Unavailable | 依赖玩家实时光标和磁力输入处理，Auto 不能验证。 |
| RP | Repel | Unavailable | 依赖玩家实时光标排斥输入，未实现。 |
| AS | Adaptive Speed | Unavailable | 速度依赖真实准确率反馈；不伪造准确率驱动。 |
| FR | Freeze Frame | Approximate preview | 同一 Combo 提前一同出现，缩圈保留各自命中时间。 |
| BU | Bubbles | Approximate preview | 命中后留下扩张并淡出的气泡；自写视觉效果。 |
| SY | Synesthesia | Approximate preview | 按音符节拍分度着色，覆盖原 Combo 色。 |
| DP | Depth | Approximate preview | 从远处向平面投影；滑条深度减速为近似。 |
| BM | Bloom | Approximate preview | Auto 连击达到 50 时光标放大至 10×。 |
| TD | Touch Device | Explanation only | 系统输入标记；不改变本工具画面，不代表模拟触屏。 |
| SV2 | Score V2 | Explanation only | 计分算法标记；没有分数模拟，不伪造 ScoreV2。 |

## Implementation notes

- Default parameters only for most experimental effects; not every lazer customization is implemented. DA, mirror axis, DT/NC rate, wiggle strength/seed are editable.
- Practice rate multiplies the MOD rate (total 0.25–4x). AR uses inverse preempt-time conversion; OD uses the standard 300-window approximation. These are not star/PP calculations and do not re-time beatmap coordinates.
- HTML media preserves music pitch for DT/HT; NC/DC disable pitch preservation. NC drums are original synthesized approximations. Hitsound pitch and exact original audio envelopes are not reproduced. No subjective listening/latency acceptance is claimed.
- Wind Up/Down use a whole-map linear ramp, not the complete official configurable speed-adjustment implementation.
- Auto combo includes heads, slider ticks/repeats/tails and spinner ends. It is a deterministic perfect-play proxy, not judgement or score simulation. FL/NS/BM/MU use it.
- MU mutes at 100 combo; no metronome or inverse-muting setting. BL uses user-supplied preview HP, not health simulation.
- Visibility, movement, projection, colours, bubbles, rotating playfield and Hidden are approximations; no pixel parity has been measured. Mirror modifies geometry and Auto together without changing the source map.
- Conservative incompatibility groups clear conflicting choices. They are not an exhaustive port of all per-parameter upstream compatibility rules.
- Sharing preserves MOD codes, custom numeric/mirror settings, practice multiplier and map time. Skin data and audio are never placed in a URL.

## Remaining work before claiming all-MOD support

1. Port and fixture-test RD's section/angle-preserving conversion and TP's generated beatmap. Do not replace either with arbitrary random circles/target rings.
2. Add actual input/replay, hit windows, tracking, judgement, health and score semantics; only then validate NF/SD/PF/CL/ST/AC/AL/SG/RX/AP/TD/SV2 and feedback-dependent AS/MG/RP.
3. Port experimental parameter ranges/easings, transition timing, all incompatible combinations and stable/lazer differences.
4. Add golden-image and real-client comparison fixtures for skin/shader/MOD combinations, plus listening/latency acceptance. Current tests are engineering checks, not client parity evidence.
