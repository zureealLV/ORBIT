// Portable validation shared by Node and Cloudflare (no filesystem imports).
export const validId = value => /^[1-9]\d{0,7}$/.test(String(value));
export function metadata(text, expectedId) {
  if (!/^\uFEFF?osu file format v\d+/m.test(text)) throw new Error('上游没有返回有效 .osu 文件');
  const id = Number(text.match(/^BeatmapID\s*:\s*(\d+)/m)?.[1]);
  const setId = Number(text.match(/^BeatmapSetID\s*:\s*(\d+)/m)?.[1]);
  if (id !== Number(expectedId) || !validId(setId)) throw new Error('上游谱面 ID 不匹配或缺少谱面集 ID');
  return {id, setId};
}
export function isZip(bytes) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
    ((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6) || (bytes[2] === 7 && bytes[3] === 8));
}
