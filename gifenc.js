// minimal animated-GIF encoder (GIF89a, global palette, LZW). no dependencies.
// frames: array of {data:Uint8ClampedArray(RGBA), width, height}; delay in 1/100 s.
function gif_encode(frames,delay,opts){
  opts = opts || {};
  let W = frames[0].width, H = frames[0].height;

  // palette: the 255 most common 5-bit colours across the frames (mean colour of each bin)
  let cnt = new Uint32Array(32768), sr = new Float64Array(32768), sg = new Float64Array(32768), sb = new Float64Array(32768);
  for (let fr of frames){
    let d = fr.data;
    for (let i = 0; i < d.length; i += 8){
      let r = d[i], g = d[i+1], b = d[i+2];
      let k = ((r>>3)<<10)|((g>>3)<<5)|(b>>3);
      cnt[k]++; sr[k] += r; sg[k] += g; sb[k] += b;
    }
  }
  let bins = [];
  for (let k = 0; k < 32768; k++) if (cnt[k]) bins.push(k);
  bins.sort((a,b)=>cnt[b]-cnt[a]);
  bins = bins.slice(0,256);
  let pal = bins.map(k=>[Math.round(sr[k]/cnt[k]),Math.round(sg[k]/cnt[k]),Math.round(sb[k]/cnt[k])]);
  while (pal.length < 256) pal.push([0,0,0]);
  let lut = new Int16Array(32768).fill(-1);
  let nearest = k=>{
    if (lut[k] >= 0) return lut[k];
    let r = ((k>>10)<<3)|4, g = (((k>>5)&31)<<3)|4, b = ((k&31)<<3)|4;
    let best = 0, bd = Infinity;
    for (let i = 0; i < bins.length; i++){
      let p = pal[i];
      let d = (p[0]-r)*(p[0]-r)+(p[1]-g)*(p[1]-g)+(p[2]-b)*(p[2]-b);
      if (d < bd){ bd = d; best = i; }
    }
    return lut[k] = best;
  };

  let out = [];
  let u16 = v=>{ out.push(v&255,(v>>8)&255); };
  for (let c of 'GIF89a') out.push(c.charCodeAt(0));
  u16(W); u16(H);
  out.push(0xF7,0,0);                       // global colour table, 256 entries
  for (let p of pal) out.push(p[0],p[1],p[2]);
  out.push(0x21,0xFF,0x0B);                 // loop forever
  for (let c of 'NETSCAPE2.0') out.push(c.charCodeAt(0));
  out.push(3,1,0,0,0);

  for (let fr of frames){
    out.push(0x21,0xF9,4,0x00); u16(delay); out.push(0,0);
    out.push(0x2C); u16(0); u16(0); u16(W); u16(H); out.push(0);
    let d = fr.data, idx = new Uint8Array(W*H);
    for (let i = 0, j = 0; i < d.length; i += 4, j++){
      idx[j] = nearest(((d[i]>>3)<<10)|((d[i+1]>>3)<<5)|(d[i+2]>>3));
    }
    out.push(8);
    let bytes = gif_lzw(idx,8);
    for (let i = 0; i < bytes.length; i += 255){
      let n = Math.min(255,bytes.length-i);
      out.push(n);
      for (let j = 0; j < n; j++) out.push(bytes[i+j]);
    }
    out.push(0);
    if (opts.progress) opts.progress(frames.indexOf(fr)+1,frames.length);
  }
  out.push(0x3B);
  return new Uint8Array(out);
}

function gif_lzw(idx,minCode){
  let clear = 1<<minCode, eoi = clear+1;
  let codeSize = minCode+1, next = eoi+1;
  let dict = new Map();
  let out = [], cur = 0, nbits = 0;
  let emit = c=>{
    cur |= c<<nbits; nbits += codeSize;
    while (nbits >= 8){ out.push(cur&255); cur >>= 8; nbits -= 8; }
  };
  emit(clear);
  let prefix = idx[0];
  for (let i = 1; i < idx.length; i++){
    let k = idx[i];
    let key = prefix*256+k;
    let v = dict.get(key);
    if (v !== undefined){ prefix = v; continue; }
    emit(prefix);
    if (next < 4096){
      dict.set(key,next);
      if (next === (1<<codeSize)) codeSize++;
      next++;
    }else{
      emit(clear); dict.clear(); codeSize = minCode+1; next = eoi+1;
    }
    prefix = k;
  }
  emit(prefix); emit(eoi);
  if (nbits > 0) out.push(cur&255);
  return out;
}

if (typeof module != "undefined") module.exports = {gif_encode};
