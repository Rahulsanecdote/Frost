/** Canonical JSON for JSON snapshots. Rejects non-JSON values rather than silently losing evidence. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    const object = value as Record<string, unknown>;
    return "{" + Object.keys(object).sort().map(key => JSON.stringify(key) + ":" + canonicalJson(object[key])).join(",") + "}";
  }
  throw new TypeError("Snapshot must contain only JSON values");
}
/** Pure SHA-256 over UTF-8; no platform crypto, I/O or runtime dependency. */
export function snapshotHash(value: unknown): string {
  const text = canonicalJson(value);
  const bytes: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp < 128) bytes.push(cp);
    else if (cp < 2048) bytes.push(192 | (cp >>> 6), 128 | (cp & 63));
    else if (cp < 65536) bytes.push(224 | (cp >>> 12), 128 | ((cp >>> 6) & 63), 128 | (cp & 63));
    else bytes.push(240 | (cp >>> 18), 128 | ((cp >>> 12) & 63), 128 | ((cp >>> 6) & 63), 128 | (cp & 63));
  }
  const length = bytes.length * 8; bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(Math.floor(length / 2 ** (i * 8)) & 255);
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const rotate = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w: number[] = [];
    for (let i = 0; i < 16; i++) w.push(((bytes[offset+i*4]! << 24) | (bytes[offset+i*4+1]! << 16) | (bytes[offset+i*4+2]! << 8) | bytes[offset+i*4+3]!) >>> 0);
    for (let i = 16; i < 64; i++) { const a=w[i-15]!, b=w[i-2]!;
      w.push((w[i-16]! + (rotate(a,7)^rotate(a,18)^(a>>>3)) + w[i-7]! + (rotate(b,17)^rotate(b,19)^(b>>>10))) >>> 0); }
    let [a,b,c,d,e,f,g,j] = h as [number,number,number,number,number,number,number,number];
    for (let i=0;i<64;i++) { const t1=(j+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+k[i]!+w[i]!)>>>0;
      const t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0; }
    [a,b,c,d,e,f,g,j].forEach((v,i)=>{h[i]=(h[i]!+v)>>>0;});
  }
  return h.map(v=>v.toString(16).padStart(8,"0")).join("");
}
