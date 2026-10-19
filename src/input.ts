export function beatmapId(input: string): number {
  const value = input.trim();
  if (/^[1-9]\d{0,7}$/.test(value)) return Number(value);
  let url: URL; try { url = new URL(value); } catch { throw new Error('请输入单难度 ID，或完整 osu! 谱面链接。'); }
  if (url.hostname !== 'osu.ppy.sh' || !['http:', 'https:'].includes(url.protocol)) throw new Error('只接受 osu.ppy.sh 谱面链接。');
  const match = url.pathname.match(/^\/(?:beatmaps|b)\/(\d+)\/?$/) ?? url.hash.match(/^#(?:osu|0)\/(\d+)$/);
  if (!match || !/^[1-9]\d{0,7}$/.test(match[1])) throw new Error('这看起来是谱面集链接。请在 osu! 页面选中具体难度，再复制带 #osu/ID 的完整链接。');
  return Number(match[1]);
}
