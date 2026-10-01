
let jsr = 0x5EED;
let {PI} = Math;
function rand(){
  jsr^=(jsr<<17);
  jsr^=(jsr>>13);
  jsr^=(jsr<<5);
  return (jsr>>>0)/4294967295;
}

var PERLIN_YWRAPB = 4; var PERLIN_YWRAP = 1<<PERLIN_YWRAPB;
var PERLIN_ZWRAPB = 8; var PERLIN_ZWRAP = 1<<PERLIN_ZWRAPB;
var PERLIN_SIZE = 4095;
var perlin_octaves = 4;var perlin_amp_falloff = 0.5;
var scaled_cosine = function(i) {return 0.5*(1.0-Math.cos(i*PI));};
var perlin;
let noise = function(x,y,z) {
  y = y || 0; z = z || 0;
  if (perlin == null) {
    perlin = new Array(PERLIN_SIZE + 1);
    for (var i = 0; i < PERLIN_SIZE + 1; i++) {
      perlin[i] = rand();
    }
  }
  if (x<0) { x=-x; } if (y<0) { y=-y; } if (z<0) { z=-z; }
  var xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
  var xf = x - xi; var yf = y - yi; var zf = z - zi;
  var rxf, ryf;
  var r=0; var ampl=0.5;
  var n1,n2,n3;
  for (var o=0; o<perlin_octaves; o++) {
    var of=xi+(yi<<PERLIN_YWRAPB)+(zi<<PERLIN_ZWRAPB);
    rxf = scaled_cosine(xf); ryf = scaled_cosine(yf);
    n1  = perlin[of&PERLIN_SIZE];
    n1 += rxf*(perlin[(of+1)&PERLIN_SIZE]-n1);
    n2  = perlin[(of+PERLIN_YWRAP)&PERLIN_SIZE];
    n2 += rxf*(perlin[(of+PERLIN_YWRAP+1)&PERLIN_SIZE]-n2);
    n1 += ryf*(n2-n1);
    of += PERLIN_ZWRAP;
    n2  = perlin[of&PERLIN_SIZE];
    n2 += rxf*(perlin[(of+1)&PERLIN_SIZE]-n2);
    n3  = perlin[(of+PERLIN_YWRAP)&PERLIN_SIZE];
    n3 += rxf*(perlin[(of+PERLIN_YWRAP+1)&PERLIN_SIZE]-n3);
    n2 += ryf*(n3-n2);
    n1 += scaled_cosine(zf)*(n2-n1);
    r += n1*ampl;
    ampl *= perlin_amp_falloff;
    xi<<=1; xf*=2; yi<<=1; yf*=2; zi<<=1; zf*=2;
    if (xf>=1.0) { xi++; xf--; }
    if (yf>=1.0) { yi++; yf--; }
    if (zf>=1.0) { zi++; zf--; }
  }
  return r;
};

function dist(x0,y0,x1,y1){
  return Math.hypot(x1-x0,y1-y0);
}
function lerp(a,b,t){
  return a * (1-t) + b * t;
}
function lerp2d(x0,y0,x1,y1,t){
  return [
    x0*(1-t) + x1*t,
    y0*(1-t) + y1*t,
  ]
}
function get_bbox(points){
  let xmin = Infinity;
  let ymin = Infinity;
  let xmax = -Infinity;
  let ymax = -Infinity
  for (let i = 0;i < points.length; i++){
    let [x,y] = points[i];
    xmin = Math.min(xmin,x);
    ymin = Math.min(ymin,y);
    xmax = Math.max(xmax,x);
    ymax = Math.max(ymax,y);
  }
  return {x:xmin,y:ymin,w:xmax-xmin,h:ymax-ymin};
}

function seg_isect(p0x, p0y, p1x, p1y, q0x, q0y, q1x, q1y, is_ray = false) {
  let d0x = p1x - p0x;
  let d0y = p1y - p0y;
  let d1x = q1x - q0x;
  let d1y = q1y - q0y;
  let vc = d0x * d1y - d0y * d1x;
  if (vc == 0) {
    return null;
  }
  let vcn = vc * vc;
  let q0x_p0x = q0x - p0x;
  let q0y_p0y = q0y - p0y;
  let vc_vcn = vc / vcn;
  let t = (q0x_p0x * d1y - q0y_p0y * d1x) * vc_vcn;
  let s = (q0x_p0x * d0y - q0y_p0y * d0x) * vc_vcn;
  if (0 <= t && (is_ray || t < 1) && 0 <= s && s < 1) {
    let ret = {t, s, side: null, other: null, xy: null};
    ret.xy = [p1x * t + p0x * (1 - t), p1y * t + p0y * (1 - t)];
    ret.side = pt_in_pl(p0x, p0y, p1x, p1y, q0x, q0y) < 0 ? 1 : -1;
    return ret;
  }
  return null;
}
function pt_in_pl(x, y, x0, y0, x1, y1) {
  let dx = x1 - x0;
  let dy = y1 - y0;
  let e = (x - x0) * dy - (y - y0) * dx;
  return e;
}

function poly_bridge(poly0,poly1){
  let dmin = Infinity;
  let imin = null;
  for (let i = 0; i < poly0.length; i++){
    for (let j = 0; j < poly1.length; j++){
      let [x0,y0] = poly0[i];
      let [x1,y1] = poly1[j];
      let dx = x0-x1;
      let dy = y0-y1;
      let d2 = dx*dx + dy*dy;
      if (d2 < dmin){
        dmin = d2;
        imin = [i,j];
      }
    }
  }
  let u = poly0.slice(0,imin[0]).concat(
    poly1.slice(imin[1])).concat(
      poly1.slice(0,imin[1])).concat(
        poly0.slice(imin[0]));
  return u;
}

function poly_union(poly0,poly1,self_isect=false){
  let verts0 = poly0.map(xy=>({xy, isects: [], isects_map: {}}));
  let verts1 = poly1.map(xy=>({xy, isects: [], isects_map: {}}));

  function pair_key() {
    return Array.from(arguments).join(',');
  }

  let has_isect = false;

  function build_vertices(poly,other,out,oout,idx){
    let n = poly.length;
    let m = other.length;
    if (self_isect){
      for (let i = 0; i < n; i++) {
        let id = pair_key(idx,i);
        let p = out[i];
        let i1 = (i + 1 + n) % n;
        let a = poly[i];
        let b = poly[i1];
        for (let j = 0; j < n; j++) {
          let jd = pair_key(idx,j);
          let j1 = (j + 1 + n) % n;
          if (i == j || i == j1 || i1 == j || i1 == j1) {
            continue;
          }
          let c = poly[j];
          let d = poly[j1];
          let xx;
          let ox = out[j].isects_map[id];
          if (ox) {
            xx = {
              t: ox.s,
              s: ox.t,
              xy: ox.xy,
              other: null,
              side: pt_in_pl(...a, ...b, ...c) < 0 ? 1 : -1
            };
          }else{
            xx = seg_isect(...a, ...b, ...c, ...d);
          }
          if (xx) {
            xx.other = j;
            xx.jump = false;
            p.isects.push(xx);
            p.isects_map[jd] = xx;
          }
        }
        
      }
    }

    for (let i = 0; i < n; i++) {
      let id = pair_key(idx,i);
      let p = out[i];
      let i1 = (i + 1 + n) % n;
      let a = poly[i];
      let b = poly[i1];
      for (let j = 0; j < m; j++) {
        let jd = pair_key(1-idx,j);
        let j1 = (j + 1 + m) % m;
        let c = other[j];
        let d = other[j1];
        let xx;

        let ox = oout[j].isects_map[id];
        if (ox) {
          xx = {
            t: ox.s,
            s: ox.t,
            xy: ox.xy,
            other: null,
            side: pt_in_pl(...a, ...b, ...c) < 0 ? 1 : -1
          };
        } else {
          xx = seg_isect(...a, ...b, ...c, ...d);
        }
        if (xx) {
          has_isect = true;
          xx.other = j;
          xx.jump = true;
          p.isects.push(xx);
          p.isects_map[jd] = xx;
        }
      }
      p.isects.sort((a2, b2) => a2.t - b2.t);
    }
  }
  build_vertices(poly0,poly1,verts0,verts1,0);
  build_vertices(poly1,poly0,verts1,verts0,1);
  
  if (!has_isect){
    if (!self_isect){
      return poly_bridge(poly0,poly1);
    }else{
      return poly_union(poly_bridge(poly0,poly1),[],true);
    }
  }


  let isect_mir = {};
  function mirror_isects(verts0,verts1,idx) {
    let n = verts0.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < verts0[i].isects.length; j++) {
        let id = pair_key(idx, i, j);
        let {jump} = verts0[i].isects[j];
        let jd = jump?(1-idx):idx;
        let k = verts0[i].isects[j].other;
        let z = (jump?verts1:verts0)[k].isects.findIndex((x) => (x.jump == jump && x.other == i));
        isect_mir[id] = [jd, k, z];
      }
    }
  }
  mirror_isects(verts0,verts1,0);
  mirror_isects(verts1,verts0,1);

  // console.log(verts0,verts1)

  function trace_outline(idx, i0, j0, dir) {
    let zero = null;
    let out = [];
    function trace_from(idx, i0, j0, dir) {
      if (zero == null) {
        zero = [idx, i0, j0];
      } else if (idx == zero[0] && i0 == zero[1] && j0 == zero[2]) {
        return true;
      }
      let verts = idx?verts1:verts0;
      let n = verts.length;
      let p = verts[i0];
      let i1 = (i0 + dir + n) % n;
      if (j0 == -1) {
        out.push(p.xy);
        if (dir < 0) {
          return trace_from(idx,i1, verts[i1].isects.length - 1, dir);
        } else if (!verts[i0].isects.length) {
          return trace_from(idx, i1, -1, dir, [i0, j0]);
        } else {
          return trace_from(idx, i0, 0, dir, [i0, j0]);
        }
      } else if (j0 >= p.isects.length) {
        return trace_from(idx, i1, -1, dir, [i0, j0]);
      } else {
        let id = pair_key(idx, i0, j0);
        out.push(p.isects[j0].xy);

        let q = p.isects[j0];
        let [jdx, k, z] = isect_mir[id];
        let params;
        if (q.side * dir < 0) {
          params = [jdx, k, z - 1, -1];
        } else {
          params = [jdx, k, z + 1, 1];
        }
        return trace_from(...params);
      }
    }
    let success = trace_from(idx, i0, j0, dir);
    if (!success || out.length < 3) {
      return null;
    }
    return out;
  }

  let xmin = Infinity;
  let amin = null;
  for (let i = 0; i < poly0.length; i++) {
    if (poly0[i][0] < xmin) {
      xmin = poly0[i][0];
      amin = [0,i];
    }
  }
  for (let i = 0; i < poly1.length; i++) {
    if (poly1[i][0] < xmin) {
      xmin = poly1[i][0];
      amin = [1,i];
    }
  }

  function check_concavity(poly, idx) {
    let n = poly.length;
    let a = poly[(idx - 1 + n) % n];
    let b = poly[idx];
    let c = poly[(idx + 1) % n];
    let cw = pt_in_pl(...a, ...b, ...c) < 0 ? 1 : -1;
    return cw;
  }

  let cw = check_concavity(amin[0]?poly1:poly0, amin[1]);
  let ret = trace_outline(...amin, -1, cw, true);
  if (!ret) {
    return [];
  }
  return ret;
}

function seg_isect_poly(x0,y0,x1,y1,poly,is_ray=false){
  let n = poly.length;
  let isects = [];
  for (let i = 0; i < poly.length; i++){
    let a = poly[i];
    let b = poly[(i+1)%n];
    let xx = seg_isect(x0,y0,x1,y1,...a,...b,is_ray);
    if (xx){
      isects.push(xx);
    }
  }
  isects.sort((a,b)=>a.t-b.t);
  return isects;
}


function clip(polyline,polygon){
  if (!polyline.length){
    return {true:[],false:[]};
  }
  let zero = seg_isect_poly(...polyline[0],polyline[0][0]+Math.E,polyline[0][1]+PI,polygon,true).length % 2 != 0;
  let out = {
    'true' :[[]],
    'false':[[]],
  }
  let io = zero;
  for (let i = 0; i < polyline.length; i++){
    let a= polyline[i];
    let b= polyline[i+1];
    out[io][out[io].length-1].push(a);
    if (!b) break;

    let isects = seg_isect_poly(...a,...b,polygon,false);
    for (let j = 0; j < isects.length; j++){
      out[io][out[io].length-1].push(isects[j].xy);
      io = !io;
      out[io].push([isects[j].xy]);
    }
  }
  out.true = out.true.filter(x=>x.length);
  out.false = out.false.filter(x=>x.length);
  return out;
}

function clip_multi(polylines,polygon,clipper_func=clip){
  let out = {
    true:[],
    false:[],
  };
  for (let i = 0; i < polylines.length; i++){
    let c = clipper_func(polylines[i],polygon);
    out.true.push(...c.true);
    out.false.push(...c.false); 
  }
  return out;
}

function binclip(polyline,func){
  if (!polyline.length){
    return {true:[],false:[]};
  }
  let bins = [];
  for (let i = 0; i < polyline.length; i++){
    let t = i/(polyline.length-1);
    bins.push(func(...polyline[i],t));
  }
  let zero = bins[0];
  let out = {
    'true' :[[]],
    'false':[[]],
  }
  let io = zero;
  for (let i = 0; i < polyline.length; i++){
    let a= polyline[i];
    let b= polyline[i+1];
    out[io][out[io].length-1].push(a);
    if (!b) break;

    let do_isect = bins[i] != bins[i+1];

    if (do_isect){
      let pt = lerp2d(...a,...b,0.5);
      out[io][out[io].length-1].push(pt);
      io = !io;
      out[io].push([pt]);
    }
  }
  out.true = out.true.filter(x=>x.length);
  out.false = out.false.filter(x=>x.length);
  return out;
}


function shade_shape(poly,step=5,dx=10,dy=20){
  let bbox = get_bbox(poly);
  bbox.x -= step;
  bbox.y -= step;
  bbox.w += step*2;
  bbox.h += step*2;
  let lines = [];
  for (let i = -bbox.h; i < bbox.w; i+=step){
    let x0 = bbox.x + i;
    let y0 = bbox.y;
    let x1 = bbox.x + i + bbox.h;
    let y1 = bbox.y + bbox.h;
    lines.push([[x0,y0],[x1,y1]]);
  }
  lines = clip_multi(lines,poly).true;

  let carve = trsl_poly(poly,-dx,-dy);

  lines = clip_multi(lines,carve).false;

  for (let i = 0; i < lines.length; i++){
    let [a,b] = lines[i];
    let s = rand()*0.5;
    if (dy > 0){
      a = lerp2d(...a,...b,s);
      lines[i][0] = a;
    }else{
      b = lerp2d(...b,...a,s);
      lines[i][1] = b;
    }
  }

  return lines;
}


function fill_shape(poly,step=5){
  let bbox = get_bbox(poly);
  bbox.x -= step;
  bbox.y -= step;
  bbox.w += step*2;
  bbox.h += step*2;
  let lines = [];
  for (let i = 0; i < bbox.w+bbox.h/2; i+=step){
    let x0 = bbox.x + i;
    let y0 = bbox.y;
    let x1 = bbox.x + i - bbox.h/2;
    let y1 = bbox.y + bbox.h;
    lines.push([[x0,y0],[x1,y1]]);
  }
  lines = clip_multi(lines,poly).true;
  return lines;
}

function patternshade_shape(poly,step=5,pattern_func){
  let bbox = get_bbox(poly);
  bbox.x -= step;
  bbox.y -= step;
  bbox.w += step*2;
  bbox.h += step*2;
  let lines = [];
  for (let i = -bbox.h/2; i < bbox.w; i+=step){
    let x0 = bbox.x + i;
    let y0 = bbox.y;
    let x1 = bbox.x + i + bbox.h/2;
    let y1 = bbox.y + bbox.h;
    lines.push([[x0,y0],[x1,y1]]);
  }
  lines = clip_multi(lines,poly).true;

  for (let i = 0; i < lines.length; i++){
    lines[i] = resample(lines[i],2);
  }

  lines = clip_multi(lines,pattern_func,binclip).true;

  return lines;
}


function vein_shape(poly,n=50){
  let bbox = get_bbox(poly);
  let out = [];
  for (let i = 0; i < n; i++){
    let x = bbox.x + rand()*bbox.w;
    let y = bbox.y + rand()*bbox.h;
    let o = [[x,y]];
    for (let j = 0; j < 15; j++){
      let dx = (noise(x*0.1,y*0.1,7)-0.5)*4;
      let dy = (noise(x*0.1,y*0.1,6)-0.5)*4;
      x += dx;
      y += dy;
      o.push([x,y]);
    }
    out.push(o);
  }
  out = clip_multi(out,poly).true;
  return out;
}

function smalldot_shape(poly,scale=1){
  let samples = [];
  let bbox = get_bbox(poly);
  poissondisk(bbox.w,bbox.h,5*scale,samples);
  for (let i = 0; i < samples.length; i++){
    samples[i][0] += bbox.x;
    samples[i][1] += bbox.y;
  }
  let out = [];
  let n = 7;
  for (let i = 0; i < samples.length; i++){
    let [x,y] =samples[i]
    let t = (y > 0) ? (y/300) : 0.5;
    // console.log(y,t);
    if ((t > 0.4 || y < 0) && t > rand()){
      continue;
    }
    for (let k = 0; k < 2; k++){
      let o = [];
      for (let j = 0; j < n; j++){
        let t = j/(n-1);
        let a = t * PI * 2;
        o.push([
          Math.cos(a)*1-k*0.3,
          Math.sin(a)*0.5-k*0.3,
        ])
      }
      o = trsl_poly(rot_poly(o,rand()*PI*2),x,y);
      out.push(o);
    }
    
  }
  return clip_multi(out,poly).true;
}

function isect_circ_line(cx,cy,r,x0,y0,x1,y1){
  //https://stackoverflow.com/a/1084899
  let dx = x1-x0;
  let dy = y1-y0;
  let fx = x0-cx;
  let fy = y0-cy;
  let a = dx*dx+dy*dy;
  let b = 2*(fx*dx+fy*dy);
  let c = (fx*fx+fy*fy)-r*r;
  let discriminant = b*b-4*a*c;
  if (discriminant<0){
    return null;
  }
  discriminant = Math.sqrt(discriminant);
  let t0 = (-b - discriminant)/(2*a);
  if (0 <= t0 && t0 <= 1){
    return t0;
  }
  let t = (-b + discriminant)/(2*a);
  if (t > 1 || t < 0){
    return null;
  }
  return t;
}

function resample(polyline,step){
  if (polyline.length < 2){
    return polyline.slice();
  }
  polyline = polyline.slice();
  let out = [polyline[0].slice()];
  let next = null;
  let i = 0;
  while(i < polyline.length-1){
    let a = polyline[i];
    let b = polyline[i+1];
    let dx = b[0]-a[0];
    let dy = b[1]-a[1];
    let d = Math.sqrt(dx*dx+dy*dy);
    if (d == 0){
      i++;
      continue;
    }
    let n = ~~(d/step);
    let rest = (n*step)/d;
    let rpx = a[0] * (1-rest) + b[0] * rest;
    let rpy = a[1] * (1-rest) + b[1] * rest;
    for (let j = 1; j <= n; j++){
      let t = j/n;
      let x = a[0]*(1-t) + rpx*t;
      let y = a[1]*(1-t) + rpy*t;
      let xy = [x,y];
      for (let k = 2; k < a.length; k++){
        xy.push(a[k]*(1-t) + (a[k] * (1-rest) + b[k] * rest)*t);
      }
      out.push(xy);
    }

    next = null;
    for (let j = i+2; j < polyline.length; j++){
      let b = polyline[j-1];
      let c = polyline[j];
      if (b[0] == c[0] && b[1] == c[1]){
        continue;
      }
      let t = isect_circ_line(rpx,rpy,step,b[0],b[1],c[0],c[1]);
      if (t == null){
        continue;
      }
 
      let q = [
        b[0]*(1-t)+c[0]*t,
        b[1]*(1-t)+c[1]*t,
      ];
      for (let k = 2; k < b.length; k++){
        q.push(b[k]*(1-t)+c[k]*t);
      }
      out.push(q);
      polyline[j-1] = q;
      next = j-1;
      break;
    }
    if (next == null){
      break;
    }
    i = next;

  }

  if (out.length > 1){
    let lx = out[out.length-1][0];
    let ly = out[out.length-1][1];
    let mx = polyline[polyline.length-1][0];
    let my = polyline[polyline.length-1][1];
    let d = Math.sqrt((mx-lx)**2+(my-ly)**2);
    if (d < step*0.5){
      out.pop(); 
    }
  }
  out.push(polyline[polyline.length-1].slice());
  return out;
}


function pt_seg_dist(p, p0, p1)  {
  // https://stackoverflow.com/a/6853926
  let x = p[0];   let y = p[1];
  let x1 = p0[0]; let y1 = p0[1];
  let x2 = p1[0]; let y2 = p1[1];
  let A = x - x1; let B = y - y1; let C = x2 - x1; let D = y2 - y1;
  let dot = A*C+B*D;
  let len_sq = C*C+D*D;
  let param = -1;
  if (len_sq != 0) {
    param = dot / len_sq;
  }
  let xx; let yy;
  if (param < 0) {
    xx = x1; yy = y1;
  }else if (param > 1) {
    xx = x2; yy = y2;
  }else {
    xx = x1 + param*C;
    yy = y1 + param*D;
  }
  let dx = x - xx;
  let dy = y - yy;
  return Math.sqrt(dx*dx+dy*dy);
}

function approx_poly_dp(polyline, epsilon){
  if (polyline.length <= 2){
    return polyline;
  }
  let dmax   = 0;
  let argmax = -1;
  for (let i = 1; i < polyline.length-1; i++){
    let d = pt_seg_dist(polyline[i] , 
                        polyline[0] , 
                        polyline[polyline.length-1] );
    if (d > dmax){
      dmax = d;
      argmax = i;
    }  
  }
  let ret = [];
  if (dmax > epsilon){
    let L = approx_poly_dp(polyline.slice(0,argmax+1),epsilon);
    let R = approx_poly_dp(polyline.slice(argmax,polyline.length),epsilon);
    ret = ret.concat(L.slice(0,L.length-1)).concat(R);
  }else{
    ret.push(polyline[0].slice());
    ret.push(polyline[polyline.length-1].slice());
  }
  return ret;
}

function distsq(x0, y0, x1, y1) {
  let dx = x0-x1;
  let dy = y0-y1;
  return dx*dx+dy*dy;
}
function poissondisk(W, H, r, samples) {
  let grid = [];
  let active = [];
  let w =  ((r) / (1.4142135624));
  let r2 = ((r) * (r));
  let cols = (~~(((W) / (w))));
  let rows = (~~(((H) / (w))));
  for (let i = (0); Number((i) < (((cols) * (rows)))); i += (1)) {
    (grid).splice((grid.length), 0, (-1));
  };
  let pos = [(((W) / (2.0))), (((H) / (2.0)))];
  (samples).splice((samples.length), 0, (pos));
  for (let i = (0); Number((i) < (samples.length)); i += (1)) {
    let col = (~~(((((((samples)[i]))[0])) / (w))));
    let row = (~~(((((((samples)[i]))[1])) / (w))));
    ((grid)[((col) + (((row) * (cols))))] = i);
    (active).splice((active.length), 0, (((samples)[i])));
  };
  while (active.length) {
    let ridx = (~~(((rand()) * (active.length))));
    pos = ((active)[ridx]);
    let found = 0;
    for (let n = (0); Number((n) < (30)); n += (1)) {
      let sr = ((r) + (((rand()) * (r))));
      let sa = ((6.2831853072) * (rand()));
      let sx = ((((pos)[0])) + (((sr) * (Math.cos(sa)))));
      let sy = ((((pos)[1])) + (((sr) * (Math.sin(sa)))));
      let col = (~~(((sx) / (w))));
      let row = (~~(((sy) / (w))));
      if (((((((((Number((col) > (0))) && (Number((row) > (0))))) && (Number((col) < (((cols) - (1))))))) && (Number((row) < (((rows) - (1))))))) && (Number((((grid)[((col) + (((row) * (cols))))])) == (-1))))) {
        let ok = 1;
        for (let i = (-1); Number((i) <= (1)); i += (1)) {
          for (let j = (-1); Number((j) <= (1)); j += (1)) {
            let idx = ((((((((row) + (i))) * (cols))) + (col))) + (j));
            let nbr = ((grid)[idx]);
            if (Number((-1) != (nbr))) {
              let d = distsq(sx, sy, ((((samples)[nbr]))[0]), ((((samples)[nbr]))[1]));
              if (Number((d) < (r2))) {
                ok = 0;
              };
            };
          };
        };
        if (ok) {
          found = 1;
          ((grid)[((((row) * (cols))) + (col))] = samples.length);
          let sample = [(sx), (sy)];
          (active).splice((active.length), 0, (sample));
          (samples).splice((samples.length), 0, (sample));
        };
      };
    };
    if (Number(!(found))) {
      (active).splice((ridx), (1));
    };
  };
}


let svg_uid = 0;
function draw_svg(polylines,opts){
  opts = opts || {};
  let frame = opts.frame !== false;
  let r2 = v=>(~~((v+10)*100))/100;
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="320" viewBox="0 0 520 320">`
  o += `<rect x="0" y="0" width="520" height="320" fill="floralwhite"/>`;
  let fills = polylines.fills || [];
  if (fills.length){
    let uid = 'bd'+(svg_uid++)+Math.random().toString(36).slice(2,7)+'_';
    let defs = '', body = '';
    let ids = new Map();
    let pd = poly=>'M '+poly.map(p=>`${r2(p[0])} ${r2(p[1])}`).join(' L ')+' Z';
    let cid = poly=>{
      if (!ids.has(poly)){
        ids.set(poly,uid+ids.size);
        defs += `<clipPath id="${uid+(ids.size-1)}"><path d="${pd(poly)}"/></clipPath>`;
      }
      return ids.get(poly);
    };
    for (let f of fills){
      let el = `<path d="${pd(f.poly)}" fill="${f.color}" stroke="none"/>`;
      if (f.clip){
        for (let c of f.clip.slice().reverse()){
          el = `<g clip-path="url(#${cid(c)})">${el}</g>`;
        }
      }
      body += el;
    }
    o += `<defs>${defs}</defs>${body}`;
  }
  if (frame) o += `<rect x="10" y="10" width="500" height="300" stroke="black" stroke-width="1" fill="none"/>`;
  o += `<path stroke="black" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" d="`
  for (let i = 0; i < polylines.length; i++){
    o += '\nM ';
    for (let j = 0; j < polylines[i].length; j++){
      let [x,y] = polylines[i][j];
      o += `${(~~((x+10)*100)) /100} ${(~~((y+10)*100)) /100} `;
    }
  }
  o += `\n"/></svg>`
  return o;
}

function draw_svg_anim(polylines,speed){
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="320">`;
  o += `<rect x="0" y="0" width="520" height="320" fill="floralwhite"/><rect x="10" y="10" width="500" height="300" stroke="black" stroke-width="1" fill="none"/>`
  let lengths = [];
  let acc_lengths = [];
  let total_l = 0;
  for (let i = 0; i < polylines.length; i++){
    let l = 0;
    for (let j = 1; j < polylines[i].length; j++){
      l += Math.hypot(
        polylines[i][j-1][0]-polylines[i][j][0],
        polylines[i][j-1][1]-polylines[i][j][1]
      );
    }
    lengths.push(l);
    acc_lengths.push(total_l);
    total_l+=l;
  }
  for (let i = 0; i < polylines.length; i++){
    let l = lengths[i];
    o += `
    <path 
      stroke="black" 
      stroke-width="1" 
      fill="none" 
      stroke-dasharray="${l}"
      stroke-dashoffset="${l}"
      d="M`;
    for (let j = 0; j < polylines[i].length; j++){
      o += polylines[i][j] + ' ';
    }
    let t = speed*l;
    o += `">
    <animate id="a${i}"
      attributeName="stroke-dashoffset" 
      fill="freeze"
      from="${l}" to="${0}" dur="${t}s" 
      begin="${(acc_lengths[i])*speed}s;a${i}.end+${8+speed*total_l-t}s"/>
    />
    <animate id="b${i}"
      attributeName="stroke-dashoffset" 
      fill="freeze"
      from="${0}" to="${l}" dur="${3}s" 
      begin="${5+speed*total_l}s;b${i}.end+${5+speed*total_l}s"/>
    />
    </path>`;
  }
  o += `</svg>`;
  return o;
}

function draw_ps(polylines){
  let o = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 520 320
1 setlinewidth
0.5 0.5 translate
/m /moveto load def
/l /lineto load def
/F /stroke load def
%%EndPageSetup
10 10 m
510 10 l
510 310 l
10 310 l
closepath
F
`;
  for (let i = 0; i < polylines.length; i++){
    for (let j = 0; j < polylines[i].length; j++){
      let [x,y] = polylines[i][j];
      o += `${(~~((x+10)*100)) /100} ${(~~((310-y)*100)) /100} `;
      if (j == 0) {
        o += `m\n`;
      } else {
        o += `l\n`;
      }
    }
    o += `F\n\n`;
  }
  return o;
}




function pow(a,b){
  return Math.sign(a) * Math.pow(Math.abs(a),b);
}

function gauss2d(x, y){
  let z0 = Math.exp(-0.5*x*x);
  let z1 = Math.exp(-0.5*y*y);
  return z0*z1;
 }

function squama_mask(w,h){
  let p = [];
  let n = 7;
  for (let i = 0; i < n; i++){
    let t = i/n;
    let a = t * PI * 2;
    let x = -pow(Math.cos(a),1.3)*w;
    let y =  pow(Math.sin(a),1.3)*h;
    p.push([x,y]);
  }
  return p;
}

function squama(w,h,m=3) {
  let p = [];
  let n = 8;
  for (let i = 0; i < n; i++){
    let t = i/(n-1);
    let a = t * PI + PI/2;
    let x = -pow(Math.cos(a),1.4)*w;
    let y =  pow(Math.sin(a),1.4)*h;
    p.push([x,y]);
  }
  let q = [p];
  for (let i = 0; i < m; i++){
    let t = i/(m-1);
    q.push([
      [-w*0.3 + (rand()-0.5),-h*0.2+t*h*0.4 + (rand()-0.5)],
      [ w*0.5 + (rand()-0.5),-h*0.3+t*h*0.6 + (rand()-0.5)]
    ]);
  }
  return q;
}

function trsl_poly(poly,x,y){
  return poly.map(xy=>[xy[0]+x,xy[1]+y]);
}
function scl_poly(poly,sx,sy){
  if (sy === undefined) sy = sx;
  return poly.map(xy=>[xy[0]*sx,xy[1]*sy]);
}
function shr_poly(poly,sx){
  return poly.map(xy=>[xy[0]+xy[1]*sx,xy[1]]);
}
function rot_poly(poly,th){
  let qoly = [];
  let costh = Math.cos(th);
  let sinth = Math.sin(th);
  for (let i = 0; i < poly.length; i++){
    let [x0,y0] = poly[i]
    let x = x0* costh-y0*sinth;
    let y = x0* sinth+y0*costh;
    qoly.push([x,y]);
  }
  return qoly;
}

function squama_mesh(m,n,uw,uh,squama_func,noise_x,noise_y,interclip=true){
  let clipper = null;

  let pts = [];
  for (let i = 0; i < n; i++){
    for (let j = 0; j < m; j++){
      let x = j*uw;
      let y = (n*uh/2) - Math.cos(i/(n-1) * PI) * (n*uh/2);
      let a = noise(x*0.005,y*0.005)*PI*2-PI;
      let r = noise(x*0.005,y*0.005);
      let dx = Math.cos(a)*r*noise_x;
      let dy = Math.cos(a)*r*noise_y;
      pts.push([x+dx,y+dy]);
    }
  }
  let out = [];

  let whs = [];
  for (let i = 0; i < n; i++){
    for (let j = 0; j < m; j++){
      if (i == 0 || j == 0 || i == n-1 || j == m-1){
        whs.push([uw/2,uh/2]);
        continue;
      }
      let a = pts[i*m+j];
      let b = pts[i*m+j+1];
      let c = pts[i*m+j-1];
      let d = pts[(i-1)*m+j];
      let e = pts[(i+1)*m+j];

      let dw = (dist(...a,...b) + dist(...a,...c))/4
      let dh = (dist(...a,...d) + dist(...a,...e))/4
      whs.push([dw,dh]);
    }
  }

  for (let j = 1; j < m-1; j++){
    for (let i = 1; i < n-1; i++){
      let [x,y]  = pts[i*m+j];
      let [dw,dh]= whs[i*m+j];
      let q = trsl_poly(squama_mask(dw,dh),x,y);

      let p = squama_func(x,y,dw,dh).map(a=>trsl_poly(a,x,y));
      if (!interclip){
        out.push(...p);
      }else{
        if (clipper){
          out.push(...clip_multi(p,clipper).false);
          clipper = poly_union(clipper,q);
        }else{
          out.push(...p);
          clipper = q;
        }
      }
    }
    for (let i = 1; i < n-1; i++){
      let a = pts[i*m+j];
      let b = pts[i*m+j+1];
      let c = pts[(i+1)*m+j];
      let d = pts[(i+1)*m+j+1];

      let [dwa,dha] = whs[i*m+j];
      let [dwb,dhb] = whs[i*m+j+1];
      let [dwc,dhc] = whs[(i+1)*m+j];
      let [dwd,dhd] = whs[(i+1)*m+j+1];

      let [x,y] = [(a[0]+b[0]+c[0]+d[0])/4,(a[1]+b[1]+c[1]+d[1])/4];
      let [dw,dh] = [(dwa+dwb+dwc+dwd)/4,(dha+dhb+dhc+dhd)/4];
      dw *= 1.2;
      let q = trsl_poly(squama_mask(dw,dh),x,y);

      let p = squama_func(x,y,dw,dh).map(a=>trsl_poly(a,x,y));
      if (!interclip){
        out.push(...p);
      }else{
        if (clipper){
          out.push(...clip_multi(p,clipper).false);
          clipper = poly_union(clipper,q);
        }else{
          out.push(...p);
          clipper = q;
        }
      }
    }
  }
  // for (let i = 0; i < n-1; i++){
  //   for (let j = 0; j < m-1; j++){
  //     let a= pts[i*m+j];
  //     let b= pts[i*m+j+1];
  //     let c = pts[(i+1)*m+j];
  //     out.push([a,b]);
  //     out.push([a,c]);
  //   }
  // }
  return out;
}

function pattern_dot(scale=1){
  let samples = [];
  poissondisk(500,300,20*scale,samples);
  let rs = [];
  for (let i = 0; i < samples.length; i++){
    rs.push((rand()*5+10)*scale)
  }
  return function(x,y){
    for (let i = 0; i < samples.length; i++){
      let r = rs[i];
      if (dist(x,y,...samples[i])<r){

        let [x0,y0] = samples[i];
        let dx = x - x0;
        let dy = y - y0;
        if (gauss2d(dx/r*2,dy/r*2)*noise(x,y,999) > 0.2){
          return true;
        }
      }
    }
    return false;
  }
}



function bean(x){
  return Math.pow(0.25-Math.pow(x-0.5,2),0.5)*(2.6+2.4*Math.pow(x,1.5))*0.542;
}

function deviate(n){
  return rand()*2*n-n;
}

function reframe(polylines,pad=20,text=null,bbox_fixed=null){
  
  let W = (500-pad*2);
  let H = (300-pad*2) - (text?10:0);
  let bbox = bbox_fixed || get_bbox(polylines.flat());
  let sw = W/bbox.w;
  let sh = H/bbox.h;
  let s = Math.min(sw,sh);
  let px = (W-bbox.w*s)/2;
  let py = (H-bbox.h*s)/2;
  for (let i = 0; i < polylines.length; i++){
    for (let j = 0; j < polylines[i].length; j++){
      let [x,y] = polylines[i][j];
      x = (x - bbox.x) * s + px+pad;
      y = (y - bbox.y) * s + py+pad;
      polylines[i][j] = [x,y];
    }
  }
  if (polylines.fills){
    let cache = new Map();
    let tpoly = poly=>{
      if (!cache.has(poly)){
        cache.set(poly,poly.map(([x,y])=>[(x-bbox.x)*s+px+pad,(y-bbox.y)*s+py+pad]));
      }
      return cache.get(poly);
    };
    for (let f of polylines.fills){
      f.poly = tpoly(f.poly);
      if (f.clip) f.clip = f.clip.map(tpoly);
    }
  }
  if (text){
    let [tw,tp] = put_text(text);
    tp = tp.map(p=>scl_poly(shr_poly(p,-0.3),0.3,0.3));
    tw *= 0.3;
    polylines.push(...tp.map(p=>trsl_poly(p,250-tw/2,300-pad+5)));
  }
  return polylines;
}

function cleanup(polylines){
  for (let i = polylines.length-1; i>=0; i--){
    polylines[i] = approx_poly_dp(polylines[i],0.1);
    for (let j = 0; j < polylines[i].length; j++){
      for (let k = 0; k < polylines[i][j].length; k++){
        polylines[i][j][k] = ~~(polylines[i][j][k]*10000)/10000;
      }
    }
    if (polylines[i].length < 2){
      polylines.splice(i,1);
      continue;
    }
    if (polylines[i].length == 2){
      if (dist(...polylines[0],...polylines[1])<0.9){
        polylines.splice(i,1);
        continue;
      }
    }
  }
  return polylines;
}

function choice(opts,percs){
  if (!percs){
    percs = opts.map(x=>1);
  }
  let s = 0;
  for (let i = 0; i < percs.length; i++){
    s += percs[i];
  }
  let r = rand()*s;
  s = 0;
  for (let i = 0; i < percs.length; i++){
    s += percs[i];
    if (r <= s){
      return opts[i];
    }
  }
}

function rndtri(a,b,c){
  let s0 = (b-a)/2;
  let s1 = (c-b)/2;
  let s = s0 + s1;
  let r = rand()*s;
  if (r < s0){
    //d * d/(b-a) / 2 = r;
    let d = Math.sqrt(2*r*(b-a));
    return a + d;
  }
  //d * d/(c-b) / 2 = s-r;
  let d = Math.sqrt(2*(s-r)*(c-b));
  return c-d;
}

let hershey_raw = {
"501":"  9I[RFJ[ RRFZ[ RMTWT",
"502":" 24G\\KFK[ RKFTFWGXHYJYLXNWOTP RKPTPWQXRYTYWXYWZT[K[",
"503":" 19H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZV",
"504":" 16G\\KFK[ RKFRFUGWIXKYNYSXVWXUZR[K[",
"505":" 12H[LFL[ RLFYF RLPTP RL[Y[",
"506":"  9HZLFL[ RLFYF RLPTP",
"507":" 23H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZVZS RUSZS",
"508":"  9G]KFK[ RYFY[ RKPYP",
"509":"  3NVRFR[",
"510":" 11JZVFVVUYTZR[P[NZMYLVLT",
"511":"  9G\\KFK[ RYFKT RPOY[",
"512":"  6HYLFL[ RL[X[",
"513":" 12F^JFJ[ RJFR[ RZFR[ RZFZ[",
"514":"  9G]KFK[ RKFY[ RYFY[",
"515":" 22G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF",
"516":" 14G\\KFK[ RKFTFWGXHYJYMXOWPTQKQ",
"517":" 25G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF RSWY]",
"518":" 17G\\KFK[ RKFTFWGXHYJYLXNWOTPKP RRPY[",
"519":" 21H\\YIWGTFPFMGKIKKLMMNOOUQWRXSYUYXWZT[P[MZKX",
"520":"  6JZRFR[ RKFYF",
"521":" 11G]KFKULXNZQ[S[VZXXYUYF",
"522":"  6I[JFR[ RZFR[",
"523":" 12F^HFM[ RRFM[ RRFW[ R\\FW[",
"524":"  6H\\KFY[ RYFK[",
"525":"  7I[JFRPR[ RZFRP",
"526":"  9H\\YFK[ RKFYF RK[Y[",
"601":" 18I\\XMX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"602":" 18H[LFL[ RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
"603":" 15I[XPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"604":" 18I\\XFX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"605":" 18I[LSXSXQWOVNTMQMONMPLSLUMXOZQ[T[VZXX",
"606":"  9MYWFUFSGRJR[ ROMVM",
"607":" 23I\\XMX]W`VaTbQbOa RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"608":" 11I\\MFM[ RMQPNRMUMWNXQX[",
"609":"  9NVQFRGSFREQF RRMR[",
"610":" 12MWRFSGTFSERF RSMS^RaPbNb",
"611":"  9IZMFM[ RWMMW RQSX[",
"612":"  3NVRFR[",
"613":" 19CaGMG[ RGQJNLMOMQNRQR[ RRQUNWMZM\\N]Q][",
"614":" 11I\\MMM[ RMQPNRMUMWNXQX[",
"615":" 18I\\QMONMPLSLUMXOZQ[T[VZXXYUYSXPVNTMQM",
"616":" 18H[LMLb RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
"617":" 18I\\XMXb RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"618":"  9KXOMO[ ROSPPRNTMWM",
"619":" 18J[XPWNTMQMNNMPNRPSUTWUXWXXWZT[Q[NZMX",
"620":"  9MYRFRWSZU[W[ ROMVM",
"621":" 11I\\MMMWNZP[S[UZXW RXMX[",
"622":"  6JZLMR[ RXMR[",
"623":" 12G]JMN[ RRMN[ RRMV[ RZMV[",
"624":"  6J[MMX[ RXMM[",
"625":" 10JZLMR[ RXMR[P_NaLbKb",
"626":"  9J[XMM[ RMMXM RM[X[",
"710":"  6MWRYQZR[SZRY",
};

let hershey_cache = {};

function compile_hershey(i){
  if (hershey_cache[i]){
    return hershey_cache[i];
  }
  var entry = hershey_raw[i];
  if (entry == null){
    return;
  }
  var ordR = 82;
  var bound= entry.substring(3,5);
  var xmin = bound.charCodeAt(0)-ordR;
  var xmax = bound.charCodeAt(1)-ordR;
  var content = entry.substring(5);
  var polylines = [[]];
  var j  = 0;
  while (j < content.length){
    var digit = content.substring(j,j+2);
    if (digit == " R"){
      polylines.push([]);
    }else{
      var x  = digit.charCodeAt(0)-ordR;
      var y  = digit.charCodeAt(1)-ordR;
      polylines[polylines.length-1].push([x,y]);
    }
    j+=2;
  }
  let data = {
    xmin:xmin,
    xmax:xmax,
    polylines:polylines,
  };
  hershey_cache[i] = data;
  return data;
}

function put_text(txt){
  let base = 500;
  let x = 0;
  let o = [];
  for (let i = 0; i < txt.length; i++){
    let ord = txt.charCodeAt(i);
    let idx;
    if (65 <= ord && ord <= 90){
      idx = base+1+(ord-65);
    }else if (97 <= ord && ord <= 122){
      idx = base + 101+(ord-97);
    }else if (ord == 46){
      idx = 710;
    }else if (ord == 32){
      x += 10;
      continue;
    }else{
      continue;
    }
    let {xmin,xmax,polylines} = compile_hershey(idx);
    polylines = polylines.map(p=>trsl_poly(p,x-xmin,0));
    o.push(...polylines);
    x += (xmax-xmin);
  }
  return [x,o];
}

function str_to_seed(str){
  let n = 1;
  for (let i = 0; i < str.length; i++){
    let x = str.charCodeAt(i)+1;
    n ^= x << (7+(i%5));
    // if (i % 2){
      n ^=(n<<17);
      n ^=(n>>13);
      n ^=(n<<5);
    // }
    n = (n>>>0) % 4294967295;
  }
  return n;
}

// ---------------------------------------------------------------- birds ---

function catmull(pts,closed=true,per=8){
  let n = pts.length;
  let out = [];
  let m = closed ? n : n-1;
  for (let i = 0; i < m; i++){
    let p0 = pts[closed ? (i-1+n)%n : Math.max(0,i-1)];
    let p1 = pts[i];
    let p2 = pts[(i+1)%n];
    let p3 = pts[closed ? (i+2)%n : Math.min(n-1,i+2)];
    for (let j = 0; j < per; j++){
      let t = j/per;
      let t2 = t*t, t3 = t2*t;
      let x = 0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3);
      let y = 0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3);
      out.push([x,y]);
    }
  }
  if (!closed) out.push(pts[n-1].slice());
  return out;
}

function close_poly(p){
  return p.concat([p[0].slice()]);
}

function circle_poly(cx,cy,r,n=20){
  let o = [];
  for (let i = 0; i < n; i++){
    let a = i/n*PI*2;
    o.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);
  }
  return o;
}

function xform(poly,th,x,y){
  return trsl_poly(rot_poly(poly,th),x,y);
}

function thick_line(pts,w0,w1=w0){
  // two offset polylines + closed outline around a centre polyline
  let L = [], R = [];
  for (let i = 0; i < pts.length; i++){
    let a = pts[Math.max(0,i-1)];
    let b = pts[Math.min(pts.length-1,i+1)];
    let d = Math.atan2(b[1]-a[1],b[0]-a[0])+PI/2;
    let w = lerp(w0,w1,i/(pts.length-1))/2;
    L.push([pts[i][0]+Math.cos(d)*w,pts[i][1]+Math.sin(d)*w]);
    R.push([pts[i][0]-Math.cos(d)*w,pts[i][1]-Math.sin(d)*w]);
  }
  return {L,R,outline:L.concat(R.slice().reverse())};
}

// a single feather in its own frame: root at origin, pointing along +x.
// the vane on the -y side is the (narrower) leading vane, the +y side the trailing one.
function feather(len,wid,arg){
  arg = arg || {};
  let tip = arg.tip || 0;           // 0 pointed, 1 round, 2 notched
  let curv = arg.curv || 0;
  let barbs = arg.barbs === undefined ? 1 : arg.barbs;
  let barb_step = arg.barb_step || 3;
  let asym = arg.asym === undefined ? 0.62 : arg.asym;
  let emarg = arg.emarg || 0;
  let sweep = arg.sweep || 1.5;
  let gaps = arg.gaps === undefined ? 1 : arg.gaps;
  let barb_from = arg.barb_from || 0.05;
  let blunt = arg.blunt || 0;
  let sd = rand()*100;
  let shape = function(t){
    if (tip == 0){
      return Math.pow(Math.sin(PI*Math.pow(t,0.62)),0.85);
    }
    if (t < 0.6){
      return Math.pow(Math.sin(t/0.6*PI/2),0.7-blunt);
    }
    return Math.sqrt(Math.max(0,1-Math.pow((t-0.6)/0.4,2)));
  };
  let hwu = t=>wid*asym*shape(t)*(1-emarg*Math.exp(-Math.pow((t-0.7)/0.09,2)));
  let hwd = t=>wid*shape(t);
  let bend = t=>curv*len*t*t;
  let n = Math.max(10,~~(len/2.5));
  let up = [], dn = [], rachis = [];
  for (let i = 0; i <= n; i++){
    let t = i/n;
    let y = bend(t);
    let j = (i==0||i==n)?0:(rand()-0.5)*0.35;
    up.push([t*len,y-hwu(t)+j]);
    dn.push([t*len,y+hwd(t)-j]);
    rachis.push([t*len,y]);
  }
  if (tip == 2){
    let m = n;
    let nt = len*0.08;
    dn[m] = up[m] = rachis[m] = [len-nt,bend(1)];
  }
  let outline = close_poly(up.concat(dn.slice(0,-1).reverse()));
  let lines = [];
  if (len > 38){
    let tl = thick_line(rachis,Math.max(1.2,wid*0.1),0.3);
    lines.push(tl.L,tl.R);
  }else{
    lines.push(rachis);
  }
  if (barbs){
    let nb = Math.max(2,~~(len/barb_step));
    for (let i = 1; i < nb; i++){
      let t = i/nb;
      if (t < barb_from) continue;
      for (let sgn = -1; sgn <= 1; sgn += 2){
        let hf = sgn < 0 ? hwu : hwd;
        let hw = hf(t);
        if (hw < 0.7) continue;
        // vane splits: a few barbs part and leave a gap
        if (gaps && noise(t*7,sd+(sgn>0?5:0),1) > 0.8) continue;
        let t2 = Math.min(1,t+sweep*hw/len);
        let tm = lerp(t,t2,0.5);
        let k = lerp(0.88,1,rand());
        let a = [t*len,bend(t)];
        let m = [tm*len,bend(tm)+sgn*hf(tm)*0.5];
        let e = [t2*len,bend(t2)+sgn*hf(t2)*k];
        lines.push([a,m,e]);
      }
    }
  }
  return {outline,lines,up,dn,rachis};
}

function place_feather(f,th,x,y){
  return {
    outline:xform(f.outline,th,x,y),
    lines:f.lines.map(l=>xform(l,th,x,y)),
  };
}

function bbox_overlap(a,b){
  return !(a.x > b.x+b.w || b.x > a.x+a.w || a.y > b.y+b.h || b.y > a.y+a.h);
}

// items are listed back to front; each item may hide those before it.
function occlude(items){
  for (let it of items){
    it.bbox = it.mask ? get_bbox(it.mask) : null;
    it.lines = it.lines.filter(l=>l.length>1);
  }
  for (let i = 0; i < items.length; i++){
    let lines = items[i].lines;
    for (let j = i+1; j < items.length; j++){
      let m = items[j];
      if (!m.mask) continue;
      if (!lines.length) break;
      let lb = get_bbox(lines.flat());
      if (!bbox_overlap(lb,m.bbox)) continue;
      lines = clip_multi(lines,m.mask).false;
    }
    items[i].lines = lines;
  }
  let out = [];
  for (let it of items){
    out.push(...it.lines);
  }
  return out;
}

function put_feather(f,a,x,y,T,fill){
  let o = T(xform(f.outline,a,x,y));
  return {lines:[o,...f.lines.map(q=>T(xform(q,a,x,y)))],mask:o,fill:fill||null};
}

function paint_color(P,key){
  if (!P.color) return null;
  return P.color.res(P.color.paint[key] || 'back');
}

function pip(x,y,poly){
  return seg_isect_poly(x,y,x+Math.E,y+PI,poly,true).length%2 != 0;
}

function with_rng(seed,fn){
  let saved = jsr;
  jsr = seed;
  try{ return fn(); }finally{ jsr = saved; }
}

// folded wing resting on the flank. all coordinates are body-local, T maps to the page.
function wing_folded(P,T,items){
  let {L,H} = P;
  let S = [L*0.14,-H*0.27+P.wing_y];
  let a0 = PI-0.12-P.wing_angle;
  let c = Math.cos(a0), sn = Math.sin(a0);
  let pos = (x,yd)=>[S[0]+c*x+sn*yd,S[1]+sn*x-c*yd];
  let WL = P.wing_len, ww = P.wing_w, bs = P.barb_step;
  let put = (f,x,yd,d,key)=>{
    let [px,py] = pos(x,yd);
    items.push(put_feather(f,a0-d,px,py,T,paint_color(P,key)));
  };
  // primaries: outermost (longest, lowest) first, inner ones lie over them
  let np = P.wing_n+2;
  for (let i = 0; i < np; i++){
    let u = i/(np-1);
    let len = WL*lerp(1.0,0.6,Math.pow(u,0.9));
    let f = feather(len,ww*0.6,{tip:P.wing_tip==0?0:1,asym:0.55,emarg:0.5*(1-u),barb_step:bs,curv:-0.02});
    put(f,lerp(0.03,0.22,u)*WL,lerp(0.9,-0.1,u)*ww,lerp(0.1,-0.03,u),'prim');
  }
  // secondaries
  let ns = 6;
  let secs = [];
  for (let i = 0; i < ns; i++){
    let u = i/(ns-1);
    let len = WL*lerp(0.56,0.44,u);
    let f = feather(len,ww*0.95,{tip:1,asym:0.7,barb_step:bs,curv:-0.015});
    let x = lerp(0.26,0.56,u)*WL, yd = lerp(0.2,-0.45,u)*ww, d = lerp(0.0,-0.1,u);
    put(f,x,yd,d,'sec');
    secs.push([x,yd,d,len]);
  }
  // tertials
  for (let i = 0; i < 3; i++){
    let f = feather(WL*(0.46-0.04*i),ww*1.05,{tip:0,asym:0.75,barb_step:bs});
    put(f,lerp(0.46,0.62,i/2)*WL,(-0.55-0.15*i)*ww,-0.06-0.04*i,'tert');
  }
  // greater coverts, one per secondary
  for (let [x,yd,d,len] of secs){
    let f = feather(len*0.42,ww*0.6,{tip:1,barbs:0});
    put(f,x-0.03*WL,yd-0.3*ww,d,'gcov');
  }
  // median coverts
  for (let i = 0; i < 6; i++){
    let u = i/5;
    let f = feather(WL*0.27,ww*0.5,{tip:1,barbs:0});
    put(f,lerp(0.1,0.56,u)*WL,lerp(0.0,-0.9,u)*ww-0.5*ww,lerp(0.02,-0.1,u),'mcov');
  }
  // lesser coverts: small scallops over the shoulder
  for (let r = 0; r < P.cov_rows+1; r++){
    let cnt = 6-r;
    for (let k = 0; k < cnt; k++){
      let u = k/(cnt-1);
      let f = feather(WL*(0.2-0.02*r),ww*(0.42-0.03*r),{tip:1,barbs:0});
      put(f,lerp(0.0,0.4,u)*WL-r*WL*0.04,lerp(-0.5,-1.2,u)*ww-r*0.35*ww,lerp(0.0,-0.1,u),'lcov');
    }
  }
}

// a fully spread wing seen broadside. root: body-local shoulder, phi: direction of the span,
// s: +1/-1 mirror so the trailing edge faces the tail.
function wing_spread(P,T,items,root,phiA,phiB,t,span,chord){
  // the wing is built at two poses (A = raised, B = lowered) and every feather is
  // interpolated between them, so a flap folds the wing back mid-stroke
  let sA = Math.sin(phiA) < 0 ? -1 : 1;
  let sB = Math.sin(phiB) < 0 ? -1 : 1;
  let s = t < 0.5 ? sA : sB;
  let mk = (phi,sg)=>{
    let c = Math.cos(phi), sn = Math.sin(phi);
    return (x,y)=>{
      y *= sg;
      return [root[0]+c*x-sn*y,root[1]+sn*x+c*y];
    };
  };
  let posA = mk(phiA,sA), posB = mk(phiB,sB);
  let bs = P.barb_step*1.0;
  let put = (f,x,y,psi,key)=>{
    let a = posA(x,y), b = posB(x,y);
    let angA = phiA+sA*psi, angB = phiB+sB*psi;
    let d = angB-angA;
    d = ((d+PI)%(PI*2)+PI*2)%(PI*2)-PI;
    items.push(put_feather(f,angA+d*t,lerp(a[0],b[0],t),lerp(a[1],b[1],t),T,paint_color(P,key)));
  };
  // primaries: outermost first
  let np = P.fly_np;
  for (let i = np-1; i >= 0; i--){
    let u = i/(np-1);
    let x = lerp(0.46,0.62,u)*span;
    let psi = lerp(1.25,0.06,u);
    let tipx = span*lerp(0.97,0.94,u);
    let len = Math.max(chord*0.5,(tipx-x)/Math.max(0.35,Math.cos(psi)));
    len = Math.min(len,chord*lerp(0.95,1.3,u));
    let f = feather(len,span*0.034,{tip:1,asym:0.5,emarg:0.5,barb_step:bs,curv:-s*0.04*u});
    put(f,x,0,psi,'prim');
  }
  // secondaries, wrist -> body
  let ns = P.fly_ns;
  let secs = [];
  for (let i = ns-1; i >= 0; i--){
    let u = i/(ns-1);   // 0 near body
    let x = lerp(0.07,0.44,u)*span;
    let psi = lerp(1.55,1.2,u);
    let len = chord*lerp(0.78,1.0,Math.sin(u*PI*0.5));
    let f = feather(len,span*0.036,{tip:1,asym:0.6,barb_step:bs,curv:-s*0.02});
    put(f,x,0,psi,'sec');
    secs.push([x,psi,len]);
  }
  // tertials along the body
  for (let i = 0; i < 3; i++){
    let f = feather(chord*(0.68-0.05*i),span*0.04,{tip:0,asym:0.7,barb_step:bs});
    put(f,span*(0.0+0.025*i),0,lerp(1.85,1.7,i/2),'tert');
  }
  // coverts: three nested rows along the arm
  for (let [x,psi,len] of secs){
    let f = feather(len*0.38,span*0.03,{tip:1,barbs:0});
    put(f,x,-0.005*span,psi,'gcov');
  }
  for (let i = 0; i < ns+np; i++){
    let u = i/(ns+np-1);
    let f = feather(chord*0.3,span*0.026,{tip:1,barbs:0});
    put(f,lerp(0.04,0.6,u)*span,-0.015*span,lerp(1.55,0.5,u),'mcov');
  }
  for (let i = 0; i < 10; i++){
    let u = i/9;
    let f = feather(chord*0.17,span*0.02,{tip:1,barbs:0});
    put(f,lerp(0.03,0.5,u)*span,-0.03*span,lerp(1.5,0.8,u),'lcov');
  }
  // alula
  for (let i = 0; i < 3; i++){
    let f = feather(chord*(0.22-0.04*i),span*0.016,{tip:0,barbs:0});
    put(f,span*0.46,-0.02*span,0.45-0.2*i,'alula');
  }
}

// direction (local frame) in which body feathers lie at a point
function body_flow(P,x,y){
  let {L,H,hr,Hc} = P;
  let hc = P.Hc0 || Hc;
  if (dist(x,y,hc[0],hc[1]) < hr*1.6){
    return Math.atan2(0.35,-1);
  }
  let a = Math.atan2(y/(H/2),x/(L/2));
  let w = Math.min(1,Math.max(0,(y/(H/2)+0.1)/0.6));
  w = w*w*(3-2*w);
  let vx = -1*(1-w)+Math.cos(a+PI/2)*w;
  let vy = 0*(1-w)+Math.sin(a+PI/2)*w;
  return Math.atan2(vy,vx);
}

// shingled rows of contour feathers, tail end first so each row overlaps the one behind it
function hrand(seed,a,b,c){
  let h = (seed ^ Math.imul(a,374761393) ^ Math.imul(b,668265263) ^ Math.imul(c,2147483647))>>>0;
  h = Math.imul(h ^ (h>>>13),1274126177);
  h = (h ^ (h>>>16))>>>0;
  return h/4294967296;
}

function body_contour(P,sil_local,T){
  let {L,H,hr} = P;
  let Hc = P.Hc, H0 = P.Hc0 || P.Hc;
  let off = [Hc[0]-H0[0],Hc[1]-H0[1]];
  let base = P.scale_size*1.5;
  let grids = [
    {sp:base*0.62,size:base*0.62,test:hd=>hd<hr*1.35,off:1},
    {sp:base*0.8, size:base*0.8, test:hd=>hd>=hr*1.35&&hd<hr*2.1,off:0.5},
    {sp:base,     size:base,     test:hd=>hd>=hr*2.1,off:0},
  ];
  // the grid is anchored to the body (and the head grid to the head) so that the
  // feathers stay put when the bird moves
  let x0 = -L*0.75, x1 = L*0.75, y0 = -H*1.7, y1 = H*0.8;
  let cells = [];
  grids.forEach((g,gi)=>{
    let iy = 0;
    for (let y = y0; y < y1; y += g.sp*0.4, iy++){
      let ix = 0;
      for (let x = x0-((iy%2)*g.sp*0.45); x < x1; x += g.sp*0.9, ix++){
        let jx = x+(hrand(P.R0,gi,ix,iy)-0.5)*g.sp*0.15;
        let jy = y+(hrand(P.R0+1,gi,ix,iy)-0.5)*g.sp*0.1;
        if (!g.test(dist(jx,jy,H0[0],H0[1]))) continue;
        jx += off[0]*g.off; jy += off[1]*g.off;
        if (!pip(jx,jy,sil_local)) continue;
        cells.push([jx,jy,g.size,gi,ix,iy]);
      }
    }
  });
  cells.sort((a,b)=>a[0]-b[0]);
  let out = [];
  for (let [x,y,size,gi,ix,iy] of cells){
    let item = with_rng((P.R0+gi*7919+ix*104729+iy*1299709)%4294967291+1,()=>{
      let ang = body_flow(P,x,y)+(rand()-0.5)*0.1;
      let len = size*1.7, wid = size*0.5;
      let f = feather(len,wid,{tip:1,asym:0.9,blunt:0.35,barbs:len>22?1:0,barb_step:Math.max(4,size*0.3),barb_from:0.55,gaps:0,sweep:1.2,curv:(rand()-0.5)*0.12});
      let rx = x-Math.cos(ang)*len*0.5, ry = y-Math.sin(ang)*len*0.5;
      let outline = xform(f.outline,ang,rx,ry);
      // only the exposed tip is inked: a rounded edge, the shaft and a few barbs
      let i0 = ~~(f.up.length*0.45);
      let arc = f.up.slice(i0).concat(f.dn.slice(i0).reverse());
      let lines = [xform(arc,ang,rx,ry),xform(f.rachis.slice(i0-1),ang,rx,ry),...f.lines.slice(1).map(q=>xform(q,ang,rx,ry))];
      let inside = outline.every(p=>pip(p[0],p[1],sil_local));
      lines = clip_multi(lines,sil_local).true;
      return {lines:lines.map(T),mask:inside?T(outline):null};
    });
    out.push(item);
  }
  return out;
}

function body_strokes(P,sil_local,T){
  let bb = get_bbox(sil_local);
  let ps = [];
  poissondisk(bb.w,bb.h,P.stroke_step,ps);
  let lines = [];
  for (let [px,py] of ps){
    let x = px+bb.x, y = py+bb.y;
    let o = [[x,y]];
    let l = P.stroke_len*(0.6+rand()*0.8);
    let ns = 6;
    for (let i = 0; i < ns; i++){
      let a = body_flow(P,x,y)+(noise(x*0.03,y*0.03)-0.5)*0.5;
      x += Math.cos(a)*l/ns;
      y += Math.sin(a)*l/ns;
      o.push([x,y]);
    }
    lines.push(o);
  }
  lines = clip_multi(lines,sil_local).true;
  return lines.map(T);
}

function bird_body_outline(P){
  let {L,H,hr,nx,ny} = P;
  let Hc = [L*0.38+nx, -H*0.5-ny];
  P.Hc = Hc;
  let [hx,hy] = Hc;
  let pts = [
    [-L*0.5, -H*0.10],
    [-L*0.2, -H*0.46],
    [ L*0.12, -H*0.52],
    [ hx-hr*0.95, hy+hr*0.6],
    [ hx-hr*0.75, hy-hr*0.55],
    [ hx, hy-hr],
    [ hx+hr*0.75, hy-hr*0.55],
    [ hx+hr*0.98, hy-hr*0.08],
    [ hx+hr*0.9, hy+hr*0.38],
    [ hx+hr*0.45, hy+hr*0.9],
    [ lerp(hx,L*0.5,0.55), lerp(hy+hr*0.9,-H*0.1,0.5)],
    [ L*0.5, H*0.02],
    [ L*0.32, H*0.42],
    [-L*0.1, H*0.52],
    [-L*0.42, H*0.18],
  ];
  return pts;
}

function bird_beak(P){
  let {hr,Hc,beak_len,beak_depth,beak_hook,beak_down} = P;
  let bx = Hc[0]+hr*0.94;
  let by = Hc[1]+hr*0.04;
  let bl = beak_len*hr;
  let bd = beak_depth*hr;
  let n = 12;
  let up = [], gape = [], low = [];
  for (let i = 0; i <= n; i++){
    let t = i/n;
    let hook = beak_hook*bl*Math.pow(t,3);
    let drop = beak_down*bl*t*t;
    let thick = Math.pow(1-t,0.85);
    up.push([bx+t*bl, by-bd*0.5*thick+hook+drop-bd*0.0]);
    gape.push([bx+t*bl, by+hook*0.9+drop+bd*0.02*Math.sin(t*PI)]);
    let lt = Math.min(1,t/0.88);
    let lthick = Math.pow(1-lt,0.9);
    let hook2 = beak_hook*bl*0.8*Math.pow(lt,3);
    low.push([bx+lt*bl*0.88, by+bd*0.5*lthick*0.85+hook2*0.7+drop*0.9+bd*0.04]);
  }
  let upper = close_poly(up.concat(gape.slice().reverse()));
  let lower = close_poly(gape.slice(0,-1).concat(low.slice().reverse()));
  let nostril = [[bx+bl*0.2,by-bd*0.2],[bx+bl*0.28,by-bd*0.22]];
  if (bl < hr*0.6) nostril = [];
  return {upper,lower,nostril,gape,tip:up[n]};
}

function bird_eye(ex,ey,r,kind){
  let out = [];
  out.push(close_poly(circle_poly(ex,ey,r,16)));
  let pr = r*0.6;
  let pup = circle_poly(ex,ey,pr,12);
  out.push(close_poly(pup));
  // pupil fill (leave a highlight)
  let hl = [ex-r*0.25,ey-r*0.25];
  let fill = fill_shape(pup,Math.max(1.2,r*0.35));
  for (let i = 0; i < fill.length; i++){
    out.push(fill[i]);
  }
  if (kind == 1){
    // eye-ring
    out.push(close_poly(circle_poly(ex,ey,r*1.6,20)));
  }else if (kind == 2){
    // brow arc
    let o = [];
    for (let i = 0; i <= 8; i++){
      let a = lerp(PI*1.05,PI*1.95,i/8);
      o.push([ex+Math.cos(a)*r*1.7,ey+Math.sin(a)*r*1.5-r*0.3]);
    }
    out.push(o);
  }
  return {lines:out,mask:circle_poly(ex,ey,r*(kind==1?1.6:1.05),16),hl};
}

function bird_leg(hip,foot_y,P,side){
  // returns lines; leg bends back at the "heel"
  let [x0,y0] = hip;
  let len = foot_y-y0;
  let heel = [x0-P.leg_bend*len*0.35, y0+len*0.45];
  let ank = [x0+P.leg_bend*len*0.1, foot_y];
  let spine = catmull([[x0,y0],heel,ank],false,8);
  let tl = thick_line(spine,P.leg_w*1.3,P.leg_w);
  let out = [tl.L,tl.R];
  let masks = [tl.outline];
  // toes: three forward one back
  let toes = [];
  let tl_ = P.toe_len;
  let angs = [-0.08,0.2,0.45,PI-0.15];
  for (let k = 0; k < 4; k++){
    let a = angs[k];
    let l = tl_*(k==3?0.6:(k==1?1:0.85));
    let dir = (k==3)?-1:1;
    let pts = [ank.slice()];
    let cx = ank[0], cy = ank[1];
    let segs = 3;
    for (let s = 1; s <= segs; s++){
      let curl = a*(1) + (k==3?-1:1)*s*0.28*(k==3?-1:1)*0 ;
      cx += Math.cos(a)*l/segs*(k==3?1:1) ;
      cy += Math.sin(a)*l/segs + s*s*0.35;
      pts.push([cx,cy]);
    }
    let sp = catmull(pts,false,5);
    let t = thick_line(sp,P.leg_w*0.75,P.leg_w*0.35);
    out.push(t.L,t.R);
    masks.push(t.outline);
    // claw
    let e = sp[sp.length-1], f = sp[sp.length-3];
    let da = Math.atan2(e[1]-f[1],e[0]-f[0]);
    out.push([e,[e[0]+Math.cos(da+0.5)*P.leg_w*1.4,e[1]+Math.sin(da+0.5)*P.leg_w*1.4]]);
  }
  return {lines:out,ank,masks:masks};
}

function bird_leg_tucked(hip,pitch,P){
  let a = pitch+PI;
  let ll = P.leg_len*0.8;
  let [x0,y0] = hip;
  let knee = [x0+Math.cos(a)*ll*0.45,y0+Math.sin(a)*ll*0.45+ll*0.12];
  let ank = [x0+Math.cos(a)*ll*0.95,y0+Math.sin(a)*ll*0.95+ll*0.05];
  let sp = catmull([[x0,y0],knee,ank],false,6);
  let tl = thick_line(sp,P.leg_w*1.3,P.leg_w);
  let out = [tl.L,tl.R], masks = [tl.outline];
  for (let k = 0; k < 3; k++){
    let ta = a+(k-1)*0.3;
    let tl2 = P.toe_len*0.55;
    let pts = [ank,[ank[0]+Math.cos(ta)*tl2*0.5,ank[1]+Math.sin(ta)*tl2*0.5+1],[ank[0]+Math.cos(ta)*tl2,ank[1]+Math.sin(ta)*tl2+2.5]];
    let t = thick_line(catmull(pts,false,4),P.leg_w*0.7,P.leg_w*0.35);
    out.push(t.L,t.R);
  }
  return {lines:out,masks};
}

function bird_branch(x0,x1,y,P){
  let out = [];
  let n = 40;
  let w = P.branch_w;
  let c = [];
  for (let i = 0; i <= n; i++){
    let t = i/n;
    c.push([lerp(x0,x1,t),y+w/2+(noise(t*3,77)-0.5)*w*1.2+t*P.branch_slope]);
  }
  let tl = thick_line(c,w*lerp(1.2,0.7,0.5),w*0.55);
  out.push(tl.L,tl.R);
  // bark strokes
  for (let i = 0; i < n*1.6; i++){
    let t = rand();
    let k = Math.min(n-1,~~(t*n));
    let p = c[k];
    let q = c[k+1];
    let ww = lerp(w*0.6,w*0.28,t);
    let yy = lerp(-ww,ww,rand());
    let l = 6+rand()*14;
    let a = [p[0],p[1]+yy*0.8];
    let b = [Math.min(x1,p[0]+l),q[1]+yy*0.8+(rand()-0.5)*1.4];
    out.push([a,b]);
  }
  // end cap
  out.push([tl.L[tl.L.length-1],tl.R[tl.R.length-1]]);
  // twig + leaves
  let leaves = [];
  if (P.leaves){
    let nt = 1+~~(rand()*2);
    for (let k = 0; k < nt; k++){
      let t = lerp(0.05,0.35,rand()) + (k*0.45);
      let ci = Math.min(n,~~(t*n));
      let [sx,sy] = c[ci];
      let side = (k%2==0)?-1:1;
      let ang = side*(0.5+rand()*0.5)+(side<0?PI:0)+(side<0?0:0);
      let a0 = -PI/2 + (rand()-0.5)*0.9 + (k%2?0.6:-0.6) + PI*0;
      let tw = [[sx,sy]];
      let ln = 40+rand()*40;
      let ca = a0;
      let px = sx, py = sy;
      for (let s = 0; s < 6; s++){
        ca += (rand()-0.5)*0.35 + 0.08*(k%2?1:-1);
        px += Math.cos(ca)*ln/6;
        py += Math.sin(ca)*ln/6;
        tw.push([px,py]);
        if (s >= 1){
          for (let side2 = -1; side2 <= 1; side2 += 2){
            let la = ca + side2*(0.9+rand()*0.5);
            let lf = feather(10+rand()*12,3.5+rand()*2.5,{tip:0,barbs:0,curv:side2*0.1});
            leaves.push(place_feather(lf,la,px,py));
          }
        }
      }
      let lf = feather(14+rand()*10,4+rand()*2,{tip:0,barbs:0});
      leaves.push(place_feather(lf,ca,px,py));
      let tt = thick_line(tw,2.2,0.8);
      out.push(tt.L,tt.R);
    }
  }
  return {lines:out,leaves};
}

function bird(arg){
  let P = Object.assign({},arg);
  let items = [];
  // every component re-seeds from this, so frames of an animation share their randomness
  let R0 = (jsr>>>0)||1;
  P.R0 = R0;
  let sub = name=>(str_to_seed(R0+'#'+name)>>>0)||1;
  let ox = 230, oy = 140;
  let flapN = 0, flapF = 0;
  if (P.ft !== undefined){
    let a = PI*2*P.ft;
    if (P.pose == 'fly'){
      flapN = (1-Math.cos(a))/2;
      flapF = (1-Math.cos(a-0.45))/2;
      oy -= 8*(flapN-0.5);
      P.pitch += 0.05*(flapN-0.5);
      P.tail_droop += 0.14*(0.5-flapN);
    }else{
      P.Hc0 = [P.L*0.38+P.nx,-P.H*0.5-P.ny];
      P.ny += 4*Math.sin(a);
      P.nx += 3*Math.sin(a+0.6);
      P.tail_droop += 0.1*Math.sin(2*a+0.5);
      P.wing_angle += 0.03*Math.sin(a+1);
      P.blink = (P.ft > 0.56 && P.ft < 0.64) ? 1 : 0;
    }
  }
  let pitch = P.pitch;
  let T = poly=>xform(poly,pitch,ox,oy);
  let Tp = p=>{
    let q = xform([p],pitch,ox,oy);
    return q[0];
  };
  let {L,H,hr} = P;

  // --- silhouette
  let ctrl = bird_body_outline(P);
  let sil_local = catmull(ctrl,true,10);
  let sil = T(sil_local);
  let sil_closed = close_poly(sil);
  let Hc = P.Hc;

  let fly = P.pose == 'fly';

  // --- far wing (flying only), behind everything
  let pose_phi = (fw,far)=>{
    if (far) return fw=='up' ? -PI/2-0.1 : (fw=='down' ? PI/2-0.1 : -PI/2-0.6);
    return fw=='up' ? -PI/2-0.5 : (fw=='down' ? PI/2+0.35 : -PI/2-1.1);
  };
  let animating = P.ft !== undefined;
  if (fly){
    jsr = sub('farwing');
    let sh = [L*0.05,-H*0.34];
    let pa = pose_phi(animating?'up':P.fly_wing,true), pb = pose_phi(animating?'down':P.fly_wing,true);
    wing_spread(P,T,items,sh,pa,pb,animating?flapF:0,P.wing_span*0.92,P.wing_chord*0.92);
  }

  // --- tail
  {
    jsr = sub('tail');
    let nt = P.tail_n;
    let base = [-L*0.42,-H*0.04];
    let basea = PI - P.tail_droop;
    let spread = P.tail_spread*(fly?1.25:1);
    let tail_items = [];
    for (let k = 0; k < nt; k++){
      let u = (nt==1) ? 0 : (k/(nt-1)*2-1); // -1..1
      let au = basea + u*spread;
      let l = P.tail_len*(1-Math.abs(u)*P.tail_taper);
      if (P.tail_type == 1){
        l = P.tail_len*(0.55+0.45*Math.abs(u));
      }else if (P.tail_type == 2){
        l = P.tail_len*(1-Math.abs(u)*0.55)*(k%2?1:0.9);
      }
      let f = feather(l,P.tail_w*(P.tail_type==2?0.7:1),{tip:P.tail_tip,curv:u*0.04,barb_step:P.barb_step,asym:0.7});
      let outer = (k==0||k==nt-1);
      tail_items.push({order:-Math.abs(u),it:put_feather(f,au,base[0],base[1],T,paint_color(P,outer?'tail_outer':'tail'))});
    }
    // outermost first, central on top
    tail_items.sort((a,b)=>a.order-b.order);
    for (let t of tail_items) items.push(t.it);
    // upper tail coverts hide the roots of the quills
    let nc = 7;
    for (let k = 0; k < nc; k++){
      let u = k/(nc-1)*2-1;
      let f = feather(P.tail_len*0.28,P.tail_w*0.55,{tip:1,barbs:0});
      items.push(put_feather(f,basea+u*spread*0.9,base[0]+L*0.03,base[1],T,paint_color(P,'tailcov')));
    }
  }

  // --- crest
  if (P.crest_n > 0){
    jsr = sub('crest');
    for (let k = 0; k < P.crest_n; k++){
      let u = P.crest_n==1 ? 0 : k/(P.crest_n-1);
      let a = lerp(-PI/2-1.1,-PI/2+0.15,u)*1;
      a = -PI/2 - 0.9 + u*0.9 + P.crest_lean;
      let cl = P.crest_len*(0.7+0.3*Math.sin(u*PI));
      let f = feather(cl,P.crest_w,{tip:0,barb_step:3.5,curv:0.1});
      let bx = Hc[0]-hr*0.25+u*hr*0.25;
      let by = Hc[1]-hr*0.8;
      items.push(put_feather(f,a,bx,by,T,paint_color(P,'crest')));
    }
  }

  // --- legs (behind the body)
  let hipL = Tp([L*0.0,H*0.42]);
  let hipR = Tp([L*0.12,H*0.42]);
  let foot_y = hipL[1]+P.leg_len;
  if (fly){
    for (let [hp,dx] of [[hipR,0],[hipL,-3]]){
      let l = bird_leg_tucked([hp[0]+dx,hp[1]],pitch,P);
      for (let m of l.masks) items.push({lines:[],mask:m,fill:paint_color(P,'legs')});
      items.push({lines:l.lines,mask:null});
    }
  }else{
    let l0 = bird_leg([hipL[0]-2,hipL[1]],foot_y,P,0);
    let l1 = bird_leg([hipR[0]+4,hipR[1]],foot_y+P.leg_stag,P,1);
    for (let m of l1.masks) items.push({lines:[],mask:m,fill:paint_color(P,'legs')});
    items.push({lines:l1.lines,mask:null});
    for (let m of l0.masks) items.push({lines:[],mask:m,fill:paint_color(P,'legs')});
    items.push({lines:l0.lines,mask:null});
    P.feet = [l0.ank,l1.ank];
  }

  // --- body
  items.push({lines:[sil_closed],mask:sil,fill:paint_color(P,'back')});

  // colour zones, all clipped to the silhouette
  let plan = P.color;
  if (plan){
    let F = plan.feat;
    let rc = role=>plan.res(role);
    let zone = (poly,role)=>items.push({lines:[],mask:null,fillpoly:T(poly),fill:rc(role),clip:[sil]});
    let [hx,hy] = Hc;
    let ex = hx+hr*P.eye_x, ey = hy-hr*P.eye_y;
    let ell = (cx,cy,rx,ry,th=0,n=14)=>{
      let o = [];
      for (let i = 0; i < n; i++){
        let a = i/n*PI*2;
        o.push([Math.cos(a)*rx,Math.sin(a)*ry]);
      }
      return xform(o,th,cx,cy);
    };
    // underparts (countershading)
    let hs = (F.hood?hr*1.1:0);
    let fl = F.flank*H;
    let bnd = catmull([
      [hx+hr*1.35,hy+hr*0.28+hs],[hx+hr*0.5,hy+hr*0.5+hs],[hx-hr*0.2,hy+hr*0.6+hs],
      [hx-hr*0.8,hy+hr*1.0+hs*0.6],[L*0.08,-H*0.12+fl],[-L*0.12,-H*0.02+fl],
      [-L*0.35,H*0.04+fl*0.5],[-L*0.62,H*0.05]],false,6);
    let belly = bnd.concat([[-L*0.62,H],[L*0.7,H],[L*0.7,hy+hr*0.4]]);
    zone(belly,'belly');
    if (plan.N >= 6){
      // a mid-tone flank band along the countershading line
      let up = bnd.map(([x,y])=>[x,y-H*0.2]);
      zone(bnd.concat(up.slice().reverse()),'mid');
    }
    if (F.cap){
      let yl = ey-P.eye_r*1.7;
      let cap = catmull([[hx+hr*1.3,yl+hr*0.12],[hx+hr*0.4,yl],[hx-hr*0.4,yl+hr*0.05],[hx-hr*1.1,yl+hr*0.55]],false,6);
      zone(cap.concat([[hx-hr*1.5,hy-hr*2],[hx+hr*1.5,hy-hr*2]]),F.cap);
    }
    if (plan.N >= 8) zone(ell(hx-hr*0.7,hy+hr*0.0+hs*0.0,hr*0.5,hr*0.6),'sheen');
    if (plan.N >= 9) zone(ell(hx+hr*0.15,ey-P.eye_r*2.3,hr*0.7,P.eye_r*0.6,-0.12),'trim2');
    if (F.eyering) zone(ell(ex,ey,P.eye_r*2.1,P.eye_r*2.1),F.eyering);
    if (F.mask) zone(ell(hx+hr*0.45,ey+P.eye_r*0.2,hr*0.85,P.eye_r*1.7,0.05),F.mask);
    if (F.bib) zone(ell(hx+hr*0.45,hy+hr*0.75,hr*0.55,hr*0.5),F.bib);
    if (F.band){
      let a = [hx-hr*0.7,hy+hr*0.95], b = [L*0.5,-H*0.04];
      let d = Math.atan2(b[1]-a[1],b[0]-a[0])+PI/2, t = hr*0.22;
      zone([[a[0]+Math.cos(d)*t,a[1]+Math.sin(d)*t],[b[0]+Math.cos(d)*t,b[1]+Math.sin(d)*t],
            [b[0]-Math.cos(d)*t,b[1]-Math.sin(d)*t],[a[0]-Math.cos(d)*t,a[1]-Math.sin(d)*t]],F.band);
    }
    if (F.rump) zone(ell(-L*0.38,-H*0.2,L*0.13,H*0.16),F.rump);
    // belly marks: spots, streaks or bars
    if (F.marks && F.marks != 'none'){
      let bb = {x:-L*0.7,y:-H*1.7,w:L*1.4,h:H*2.5};
      let mk = [];
      if (F.marks == 'bars'){
        for (let y = -H*0.1; y < H*0.6; y += hr*0.34){
          let o = [];
          for (let x = -L*0.6; x <= L*0.6; x += L*0.1) o.push([x,y+Math.sin(x*0.09)*1.2]);
          mk.push(o.concat(o.slice().reverse().map(([x,yy])=>[x,yy+hr*0.13])));
        }
      }else{
        let ps = [];
        with_rng(plan.seed,()=>{
          poissondisk(bb.w,bb.h,F.marks=='spots'?hr*0.42:hr*0.36,ps);
          for (let [px,py] of ps){
            let x = px+bb.x, y = py+bb.y;
            if (y < hy+hr*0.9 && x > L*0.1) continue;
            if (!pip(x,y,sil_local) || !pip(x,y,belly)) continue;
            if (F.marks == 'spots'){
              mk.push(ell(x,y,hr*0.1,hr*0.12,rand()*PI));
            }else{
              mk.push(ell(x,y,hr*0.07,hr*0.2,body_flow(P,x,y)-PI/2));
            }
          }
        });
      }
      for (let m of mk){
        items.push({lines:[],mask:null,fillpoly:T(m),fill:rc(plan.N>=10?'dark2':'dark'),clip:[sil,T(belly)]});
      }
    }
  }

  // plumage texture
  jsr = sub('plumage');
  let tex = [];
  let bb = get_bbox(sil);
  let pattern_func = null;
  if (P.pattern_type == 1){
    pattern_func = pattern_dot(P.pattern_scale*0.6);
  }else if (P.pattern_type == 2){
    pattern_func = (x,y)=>(noise(x*0.06,y*0.06)<0.38);
  }else if (P.pattern_type == 3){
    pattern_func = (x,y)=>{
      let dx = noise(x*0.01,y*0.01)*30;
      return (~~((x+dx)/(14*P.pattern_scale)))%2 == 1;
    };
  }
  if (P.plumage_type == 0){
    // contour feathers
    for (let it of body_contour(P,sil_local,T)) tex.push(it);
  }else if (P.plumage_type == 3){
    // scallops: rows of overlapping feathers, back to front
    let sw = P.scale_size;
    let m = 0;
    let scs = [];
    for (let y = bb.y; y < bb.y+bb.h+sw; y += sw*0.62){
      for (let x = bb.x - ((m%2)*sw*0.5); x < bb.x+bb.w+sw; x += sw){
        let jx = x+(rand()-0.5)*sw*0.2;
        let jy = y+(rand()-0.5)*sw*0.2;
        let hd = dist(jx,jy,...Tp(Hc));
        let k = hd < hr*1.5 ? 0.55 : 1;
        scs.push([jx,jy,sw*k]);
      }
      m++;
    }
    for (let [x,y,s] of scs){
      let inside = pip(x,y,sil);
      if (!inside) continue;
      let u = [], n = 9;
      for (let i = 0; i <= n; i++){
        let a = lerp(0,PI,i/n);
        u.push([-Math.cos(a)*s*0.5,Math.sin(a)*s*0.5]);
      }
      let U = xform(u,pitch,x,y);
      tex.push({lines:[U],mask:close_poly(U)});
    }
  }else if (P.plumage_type == 1){
    tex.push({lines:shade_shape(sil,P.hatch_step,-16,-22),mask:null});
  }else if (P.plumage_type == 2){
    tex.push({lines:body_strokes(P,sil_local,T),mask:null});
  }
  if (pattern_func){
    let ps = patternshade_shape(sil,P.pattern_step,pattern_func);
    if (!plan) tex.push({lines:ps,mask:null});
  }
  // belly shading hatch for volume
  if (P.plumage_type != 1 && P.belly_shade){
    tex.push({lines:shade_shape(sil,P.belly_shade,-10,-14),mask:null});
  }
  for (let t of tex){
    if (t.mask){
      t.lines = t.lines.filter(l=>l.length>1);
    }else{
      t.lines = clip_multi(t.lines,sil).true;
    }
    items.push(t);
  }

  // --- wing
  jsr = sub('wing');
  if (fly){
    let sh = [L*0.0,-H*0.3];
    let pa = pose_phi(animating?'up':P.fly_wing,false), pb = pose_phi(animating?'down':P.fly_wing,false);
    wing_spread(P,T,items,sh,pa,pb,animating?flapN:0,P.wing_span,P.wing_chord);
  }else{
    wing_folded(P,T,items);
  }

  // --- head details
  jsr = sub('head');
  let bk = bird_beak(P);
  let upper = T(bk.upper), lower = T(bk.lower);
  {
    // beak hides nothing but must not cross the face
    if (plan){
      items.push({lines:[],mask:null,fillpoly:upper,fill:paint_color(P,'beak')});
      items.push({lines:[],mask:null,fillpoly:lower,fill:paint_color(P,'beak')});
    }
    items.push({lines:[upper,lower,...(bk.nostril.length?[T(bk.nostril)]:[])],mask:null,beak:true});
  }
  let ex = Hc[0]+hr*P.eye_x, ey = Hc[1]-hr*P.eye_y;
  let eye = bird_eye(...Tp([ex,ey]),P.eye_r,P.eye_kind);
  if (plan){
    items.push({lines:[],mask:null,fillpoly:circle_poly(...Tp([ex,ey]),P.eye_r,16),fill:paint_color(P,'eye')});
    items.push({lines:[],mask:null,fillpoly:circle_poly(...Tp([ex,ey]),P.eye_r*0.62,12),fill:'#1b1b1b'});
  }
  if (P.blink){
    // eyelid closed
    let [cx,cy] = Tp([ex,ey]);
    if (plan) items.push({lines:[],mask:null,fillpoly:circle_poly(cx,cy,P.eye_r*1.1,12),fill:paint_color(P,'back')});
    items.push({lines:[[[cx-P.eye_r*1.3,cy],[cx+P.eye_r*1.3,cy+0.6]]],mask:null});
  }else{
    items.push({lines:eye.lines,mask:eye.mask});
  }

  // --- perch, drawn behind everything
  let back = [];
  if (!fly){
    jsr = sub('branch');
    let clone_br = b=>({lines:b.lines.map(l=>l.map(p=>p.slice())),
      leaves:b.leaves.map(l=>({outline:l.outline.map(p=>p.slice()),lines:l.lines.map(q=>q.map(p=>p.slice()))}))});
    let br;
    if (P.shared && P.shared.br){
      br = clone_br(P.shared.br);
    }else{
      let feet = P.feet;
      let by = Math.max(feet[0][1],feet[1][1])+P.leg_w*0.8;
      let bbx = get_bbox(items.map(it=>it.lines).flat().flat());
      br = bird_branch(bbx.x-P.branch_ext0,bbx.x+bbx.w+P.branch_ext1,by,P);
      if (P.shared){
        P.shared.br = clone_br(br);
      }
    }
    back.push({lines:br.lines,mask:null});
    for (let lf of br.leaves){
      back.push({lines:[lf.outline,...lf.lines],mask:lf.outline});
    }
  }
  let fills = [];
  if (plan){
    let cp = new Map();
    let copy = poly=>{
      if (!cp.has(poly)) cp.set(poly,poly.map(p=>p.slice()));
      return cp.get(poly);
    };
    for (let it of items){
      if (!it.fill) continue;
      let poly = it.fillpoly || it.mask;
      if (poly) fills.push({poly:copy(poly),color:it.fill,clip:it.clip?it.clip.map(copy):null});
    }
  }
  let lines = occlude(back.concat(items));
  if (plan) lines.fills = fills;
  return lines;
}

// ------------------------------------------------------------- colour ---

function hsl_hex(h,sat,l){
  h = ((h%360)+360)%360;
  sat = Math.max(0,Math.min(1,sat));
  l = Math.max(0,Math.min(1,l));
  let a = sat*Math.min(l,1-l);
  let f = n=>{
    let k = (n+h/30)%12;
    let c = l-a*Math.max(-1,Math.min(k-3,9-k,1));
    return ('0'+Math.round(c*255).toString(16)).slice(-2);
  };
  return '#'+f(0)+f(8)+f(4);
}

// each archetype is a plumage family with realistic colour placement. colours are
// [hue,sat,light]; roles: back / belly / dark / accent / trim.
// feat says where the colours go on the bird.
let COLOR_ARCH = {
  sparrow:()=>({
    back:[deviate(8)+28,0.45,0.38], belly:[40,0.25,0.82], dark:[22,0.35,0.16],
    accent:[deviate(6)+14,0.65,0.4], trim:[45,0.3,0.93],
    feat:{cap:choice(['accent',null],[2,1]),mask:choice(['dark',null],[2,1]),bib:choice(['dark',null],[1,2]),
      wingbars:'trim',sec:'accent',prim:'dark',tail:'back',marks:choice(['streaks','none','spots'],[3,1,1]),flank:0.02},
    beak:'belly',legs:'belly'}),
  bluebird:()=>{
    let rust = rand()<0.4;
    return {
      back:[deviate(12)+212,0.7,0.45], belly:rust?[18,0.6,0.58]:[210,0.12,0.9], dark:[225,0.55,0.14],
      accent:[deviate(10)+190,0.65,0.6], trim:[0,0,0.97],
      feat:{crest:'back',mask:choice(['dark',null],[2,1]),band:rust?null:choice(['dark',null],[1,1]),wingbars:'trim',
        prim:'accent',sec:'back',tail:'back',outer_tail:'trim',marks:'none',flank:rust?-0.05:0.05},
      beak:'dark',legs:'dark'};},
  vermilion:()=>({
    back:[deviate(10)+25,0.2,0.24], belly:[deviate(6)+4,0.85,0.5], dark:[20,0.15,0.08],
    accent:[28,0.85,0.55], trim:[30,0.1,0.85],
    feat:{cap:'belly',mask:'dark',prim:'dark',sec:'back',tail:'dark',marks:'none',rump:'belly',flank:0.0},
    beak:'dark',legs:'dark'}),
  tropical:()=>({
    back:[deviate(20)+125,0.6,0.38], belly:[deviate(8)+55,0.75,0.6], dark:[232,0.5,0.15],
    accent:[deviate(5)+358,0.8,0.5], trim:[deviate(10)+195,0.7,0.5],
    feat:{cap:'accent',bib:choice(['accent',null],[1,2]),crest:'accent',prim:'trim',sec:'back',wingbars:'belly',tail:'accent',outer_tail:'trim',marks:'none',flank:0.1},
    beak:choice(['accent','dark'],[1,1]),legs:'dark'}),
  goldfinch:()=>({
    back:[deviate(6)+52,0.9,0.55], belly:[0,0,0.95], dark:[40,0.1,0.12],
    accent:[28,0.85,0.55], trim:[55,0.9,0.85],
    feat:{cap:'dark',wingbars:'trim',prim:'dark',sec:'dark',tert:'dark',tail:'dark',outer_tail:'trim',rump:'trim',marks:'none',flank:0.0},
    beak:'accent',legs:'accent'}),
  raptor:()=>({
    back:[deviate(8)+26,0.35,0.3], belly:[42,0.35,0.85], dark:[20,0.3,0.1],
    accent:[48,0.85,0.55], trim:[deviate(5)+18,0.5,0.5],
    feat:{mask:'dark',eyering:'accent',marks:choice(['bars','spots','streaks'],[3,2,2]),prim:'dark',sec:'back',wingbars:'trim',tail:'trim',rump:'belly',flank:0.0},
    beak:'dark',legs:'accent'}),
  corvid:()=>({
    back:[deviate(10)+232,0.35,0.17], belly:[232,0.22,0.3], dark:[235,0.3,0.07],
    accent:[deviate(10)+175,0.6,0.38], trim:[deviate(10)+285,0.4,0.42],
    feat:{prim:'dark',sec:'accent',wingbars:'trim',tail:'accent',marks:'none',flank:0.05},
    beak:'dark',legs:'dark'}),
  kingfisher:()=>({
    back:[deviate(8)+185,0.7,0.42], belly:[deviate(8)+28,0.85,0.55], dark:[225,0.5,0.14],
    accent:[0,0,0.97], trim:[16,0.55,0.4],
    feat:{mask:'dark',band:choice(['accent',null],[1,1]),bib:choice(['accent',null],[1,1]),prim:'dark',sec:'back',wingbars:'accent',tail:'back',marks:'none',flank:0.0},
    beak:'dark',legs:'trim'}),
  dove:()=>({
    back:[215,0.1,0.55], belly:[deviate(8)+340,0.25,0.76], dark:[220,0.15,0.2],
    accent:[345,0.45,0.65], trim:[40,0.15,0.93],
    feat:{band:choice(['dark',null],[1,1]),eyering:'accent',prim:'dark',sec:'back',wingbars:'dark',tail:'back',outer_tail:'trim',marks:'none',flank:0.08},
    beak:'dark',legs:'accent'}),
};

function generate_color_plan(P,N,seed){
  N = Math.max(1,Math.min(10,N|0));
  return with_rng(str_to_seed(seed+'#color'),()=>{
    let names = ['sparrow','bluebird','vermilion','tropical','goldfinch','raptor','corvid','kingfisher','dove'];
    let W = {
      finch:[3,0,2,0,3,0,0,0,1], songbird:[2,2,0,1,1,0,0,0,1], thrush:[1,1,0,0,0,3,0,0,0],
      raptor:[0,0,0,0,0,5,1,0,0], longbill:[1,0,0,3,0,0,0,2,0], jay:[0,4,0,0,0,0,2,0,0],
      wren:[4,0,0,0,0,1,0,0,0], swallow:[0,2,0,0,0,0,1,1,0], parrot:[0,0,0,5,0,0,0,0,0],
      crane:[1,0,0,0,0,0,1,0,2],
    };
    let name = choice(names,(W[P.kind]||names.map(x=>1)).map(x=>x+0.2));
    let A = COLOR_ARCH[name]();
    let hex = {};
    for (let r of ['back','belly','dark','accent','trim']){
      hex[r] = hsl_hex(...A[r]);
    }
    // extra colours (6-10) are harmonies of the base set
    let [bh,bs,bl] = A.back, [lh,ls,ll] = A.belly;
    hex.mid = hsl_hex(bh,(bs+ls)/2,(bl+ll)/2);
    hex.accent2 = hsl_hex(A.accent[0]+38,A.accent[1],Math.min(0.7,A.accent[2]+0.06));
    hex.sheen = hsl_hex(bh+28,Math.min(1,bs+0.12),Math.min(0.75,bl+0.14));
    hex.trim2 = hsl_hex(lh-18,Math.min(0.7,ls+0.25),Math.min(0.92,ll+0.02));
    hex.dark2 = hsl_hex(A.dark[0]+12,A.dark[1]+0.08,A.dark[2]+0.1);
    let order = ['back','belly','dark','accent','trim','mid','accent2','sheen','trim2','dark2'];
    let res = function(role){
      if (!role) role = 'back';
      let idx = order.indexOf(role);
      if (idx < N) return hex[role];
      if (role == 'belly')   return hex.back;
      if (role == 'dark')    return hex.back;
      if (role == 'accent')  return N>=3 ? hex.dark : (N>=2 ? hex.belly : hex.back);
      if (role == 'trim')    return N>=2 ? hex.belly : hex.back;
      if (role == 'mid')     return hex.back;
      if (role == 'accent2') return res('accent');
      if (role == 'sheen')   return hex.back;
      if (role == 'trim2')   return res('trim');
      if (role == 'dark2')   return res('dark');
      return hex.back;
    };
    let F = A.feat;
    let up = (base,role,minN)=>N>=minN ? role : base;
    let tailb = F.tail||'dark';
    let paint = {
      back:'back', prim:F.prim||'dark', sec:F.sec ? F.sec : up('back','accent2',7),
      tert:up(F.tert||'dark','dark2',10),
      gcov:F.wingbars||'back', mcov:up(up('back','mid',6),'trim2',9), lcov:up('back','mid',6), alula:'dark',
      tail:tailb, tail_outer:up(F.outer_tail||tailb,'trim2',9), tailcov:up(F.rump||F.tail||'back','accent2',7),
      crest:up(F.crest||'dark','sheen',8), beak:A.beak, legs:A.legs, eye:name=='raptor'?'accent':'trim',
    };
    let swatches = order.slice(0,N).map(r=>hex[r]);
    return {N,name,hex,res,feat:F,paint,swatches,seed:str_to_seed(seed+'#marks'),arch:A};
  });
}

function bird_default_params(){
  return {
    L:150,H:90,hr:26,nx:0,ny:6,
    pitch:-0.25,
    beak_len:1.0,beak_depth:0.7,beak_hook:0.0,beak_down:0.0,
    eye_x:0.35,eye_y:0.05,eye_r:3.6,eye_kind:0,
    tail_type:0,tail_n:7,tail_len:110,tail_w:11,tail_spread:0.28,tail_taper:0.2,tail_droop:0.2,tail_tip:1,
    wing_n:6,wing_len:105,wing_w:11,wing_taper:0.55,wing_tip:1,wing_angle:0,wing_y:0,cov_rows:2,
    crest_n:0,crest_len:20,crest_w:3,crest_lean:0,
    leg_len:55,leg_w:3,leg_bend:0.5,leg_stag:0,toe_len:16,
    plumage_type:0,scale_size:12,hatch_step:5,stroke_step:5,stroke_len:14,
    pattern_type:0,pattern_scale:1,pattern_step:3.5,belly_shade:0,
    barb_step:6,
    branch_w:9,branch_slope:0,branch_ext0:30,branch_ext1:50,leaves:true,
  };
}

function generate_bird_params(pose){
  if (pose === undefined || pose == 'any') pose = choice(['perch','fly'],[1,1]);
  let P = bird_default_params();
  P.pose = pose;
  let kind = choice(['finch','songbird','thrush','raptor','longbill','jay','wren','swallow','parrot','crane'],[3,4,3,2,2,3,2,2,2,1]);
  P.kind = kind;
  P.L = rndtri(120,150,190);
  P.H = P.L*rndtri(0.5,0.62,0.78);
  P.hr = P.H*rndtri(0.26,0.34,0.42);
  P.pitch = rndtri(-0.4,-0.2,0.05);
  P.ny = rndtri(0,6,16);
  P.nx = rndtri(-4,2,10);
  P.tail_type = choice([0,1,2,3],[5,2,2,1]);
  P.tail_n = ~~rndtri(5,8,12);
  P.tail_len = P.L*rndtri(0.5,0.7,1.1);
  P.tail_w = P.L*rndtri(0.07,0.1,0.13);
  P.tail_spread = rndtri(0.2,0.38,0.6);
  P.tail_droop = rndtri(-0.15,0.1,0.3);
  P.tail_tip = choice([0,1,2],[1,3,1]);
  if (P.tail_type == 1){ P.tail_n = 5; P.tail_spread = rndtri(0.2,0.3,0.45); P.tail_w = P.L*0.045; P.tail_len *= 1.1; P.tail_tip = 0;}
  if (P.tail_type == 2){ P.tail_n = ~~rndtri(3,5,7); P.tail_len = P.L*rndtri(1,1.3,1.8); P.tail_spread = rndtri(0.04,0.08,0.14); P.tail_w = P.L*0.05; P.tail_tip = choice([0,1],[1,1]);}
  if (P.tail_type == 3){ P.tail_len = P.L*0.35; P.tail_droop = -0.7; P.tail_spread = 0.3;P.tail_taper=0.1;}
  P.wing_n = ~~rndtri(5,7,9);
  P.wing_len = P.L*rndtri(0.65,0.8,1.0);
  P.wing_w = P.H*rndtri(0.14,0.18,0.23);
  P.wing_taper = rndtri(0.4,0.55,0.75);
  P.wing_tip = choice([0,1],[3,2]);
  P.wing_angle = rndtri(-0.1,0.0,0.15);
  P.cov_rows = choice([1,2,3],[1,3,2]);
  P.crest_n = choice([0,3,5,7],[5,1,2,1]);
  P.crest_len = P.hr*rndtri(0.7,1.1,1.8);
  P.crest_w = P.hr*0.14;
  P.crest_lean = rndtri(-0.3,0.2,0.7);
  P.beak_len = rndtri(0.7,1.1,1.6);
  P.beak_depth = rndtri(0.45,0.7,0.95);
  P.beak_hook = choice([0,0.12,0.3],[6,2,1]);
  P.beak_down = rndtri(0,0.05,0.2);
  if (kind == 'longbill'){ P.beak_len = rndtri(2.2,3,4); P.beak_depth = 0.28; P.beak_down = rndtri(0.02,0.1,0.25);P.beak_hook=0; }
  if (kind == 'finch'){ P.beak_len = 0.65; P.beak_depth = 0.95; P.beak_hook = 0; P.hr *= 1.1;}
  if (kind == 'raptor'){ P.beak_len = 0.9; P.beak_depth = 0.95; P.beak_hook = 0.35; P.beak_down=0; P.eye_kind = 2; P.hr*=1.1; P.crest_n=0;}
  if (kind == 'parrot'){ P.beak_len = 0.95; P.beak_depth = 1.1; P.beak_hook = 0.45; P.hr*=1.15; P.tail_type=2; P.tail_n=5; P.tail_spread=0.08; P.tail_len=P.L*1.2; P.tail_w = P.L*0.05; P.tail_tip=0;}
  if (kind == 'swallow'){ P.tail_type=1; P.tail_n=5; P.tail_spread=0.35; P.tail_w=P.L*0.04; P.tail_len=P.L*0.9; P.tail_tip=0; P.wing_len=P.L*0.95; P.wing_tip=0; P.beak_len=0.6; P.beak_depth=0.8;P.crest_n=0;}
  if (kind == 'wren'){ P.tail_type=3; P.tail_len=P.L*0.4; P.tail_droop=-0.9; P.L*=0.8; P.H=P.L*0.7; P.hr=P.H*0.38; P.beak_len=1.3;P.beak_depth=0.35;P.crest_n=0;}
  if (kind == 'crane'){ P.hr=P.H*0.22; P.nx=14; P.ny=34; P.beak_len=3.2; P.beak_depth=0.5; P.beak_hook=0;P.beak_down=0.03;P.leg_len=P.L*0.9;P.crest_n=0;P.pitch=-0.15;}
  P.eye_x = rndtri(0.25,0.4,0.5);
  P.eye_y = rndtri(0,0.12,0.25);
  P.eye_r = Math.max(2.4,P.hr*rndtri(0.1,0.14,0.2));
  P.eye_kind = P.eye_kind || choice([0,1,2],[4,2,1]);
  P.leg_len = (kind=='crane') ? P.leg_len : P.H*rndtri(0.28,0.4,0.6);
  P.leg_w = rndtri(3,3.8,5);
  P.leg_bend = rndtri(0.2,0.6,1);
  P.leg_stag = rndtri(-4,0,4);
  P.toe_len = P.leg_len*rndtri(0.22,0.3,0.4)+8;
  P.plumage_type = choice([0,1,2,3],[8,0,2,1]);
  P.scale_size = P.L*rndtri(0.085,0.1,0.125);
  P.flank_dummy = 0;
  P.hatch_step = rndtri(6,8,10);
  P.stroke_step = rndtri(6,8,11);
  P.stroke_len = P.L*rndtri(0.08,0.11,0.16);
  P.pattern_type = choice([0,1,2,3],[3,2,2,1]);
  if (P.plumage_type == 1 && P.pattern_type == 0) P.pattern_type = choice([1,2,3]);
  P.pattern_scale = rndtri(0.7,1,1.5);
  P.pattern_step = rndtri(3,3.6,5);
  P.belly_shade = choice([0,8,11],[3,2,1]);
  P.branch_w = rndtri(7,9,13);
  P.branch_slope = rndtri(-10,0,10);
  P.branch_ext0 = rndtri(20,40,80);
  P.branch_ext1 = rndtri(30,60,110);
  P.leaves = rand() < 0.6;
  // more feathers, rendered finer
  P.wing_n = ~~rndtri(5,6,8);
  P.barb_step = rndtri(4,4.6,5.5);
  P.tail_n = Math.max(P.tail_n,(P.tail_type==0)?~~rndtri(8,10,12):P.tail_n);
  if (pose == 'fly'){
    P.pitch = rndtri(-0.3,-0.1,0.15);
    P.tail_droop = rndtri(-0.1,0.05,0.2);
    P.ny = rndtri(0,3,8);
    P.nx = rndtri(4,10,16);
    let long_wing = (kind=='raptor'||kind=='swallow'||kind=='crane') ? 1.25 : (kind=='wren'||kind=='finch' ? 0.85 : 1);
    P.wing_span = P.L*rndtri(1.3,1.65,2.1)*long_wing;
    P.wing_chord = P.wing_span*rndtri(0.26,0.31,0.38)*(kind=='swallow'?0.8:1);
    P.fly_wing = choice(['up','mid','down'],[4,2,3]);
    P.fly_np = ~~rndtri(7,9,11);
    P.fly_ns = ~~rndtri(7,9,11);
    P.tail_spread *= 1.15;
    if (kind=='crane') P.leg_len = P.L*0.9;
  }
  return P;
}

function binomen(){
  let g0 = ["Aqui","Alau","Ardea","Bubo","Buteo","Calli","Cardu","Cyano","Chryso","Colum","Corv","Cuc","Dend","Emberi","Falc","Fring","Garru","Hirun","Icter","Lanio","Meli","Muscic","Nect","Oriol","Paro","Pass","Phasi","Pic","Pipr","Psitt","Pyrrh","Rall","Regul","Sitt","Stern","Strix","Sturn","Sylv","Troglo","Turd","Upu","Vire","Zosterop"];
  let g1 = ["","","a","o","i","ro","la","ni","po"];
  let g2 = ["ornis","avis","pteryx","corax","cola","phaga","thraupis","ptila","phila","dytes","pipra","tes","us","a","ula","ura","ides"];
  let s0 = ["alb","arg","aur","azur","bicolor","brev","caerul","canor","carmin","chlor","cinere","coron","crist","flav","fulv","glori","gracil","grand","iri","long","magn","maxim","melan","micr","migrat","nigr","nobil","ocell","orient","pall","parv","pict","pulchr","purpur","rub","rufi","sple","strid","tenu","tri","varie","vir","vulg"];
  let s1 = ["a","ens","ensis","ii","ica","icus","oides","ipes","irostris","ocephala","ura","ptera","us","is","ior","ata","atus","inus"];
  let name = choice(g0)+choice(g1)+choice(g2);
  name = name[0].toUpperCase()+name.slice(1).toLowerCase();
  let sp = choice(s0)+choice(s1);
  sp = sp.replace(/([aeiou])\1/g,'$1');
  return name+' '+sp;
}

function new_seed(){
  jsr = ~~(Math.random()*10000);
  return binomen();
}

function bird_main(seed,pose,colors,opts){
  opts = opts || {};
  if (seed === undefined){
    jsr = ~~(Math.random()*10000);
    seed = binomen();
  }
  jsr = str_to_seed(seed);
  let params = generate_bird_params(pose);
  if (colors) params.color = generate_color_plan(params,colors,seed);
  let drawing = bird(params);
  return cleanup(reframe(drawing,20,opts.name===false?null:seed+'.'));
}

// a looping animation of one bird, built frame by frame so a page can stay responsive:
//   let job = bird_frame_job(seed,pose,colors);  for (i<job.n) job.step(i);  job.finish()
// flying birds flap; perched birds bob their head, flick their tail and blink.
// all frames share one framing.
function bird_frame_job(seed,pose,colors,n,opts){
  opts = opts || {};
  if (seed === undefined) seed = new_seed();
  jsr = str_to_seed(seed);
  // keep the pose argument as given (it may be undefined = 'surprise'): choosing the pose
  // consumes a random number, and every frame must see the same stream bird_main sees
  let pose_arg = pose;
  pose = generate_bird_params(pose_arg).pose;
  n = n || (pose=='fly' ? 20 : 30);
  let shared = {};
  let raw = [];
  return {
    n,pose,seed,
    step(f){
      jsr = str_to_seed(seed);
      let params = generate_bird_params(pose_arg);
      if (colors) params.color = generate_color_plan(params,colors,seed);
      params.ft = f/n;
      params.shared = shared;
      raw[f] = bird(params);
    },
    finish(){
      let pts = [];
      for (let r of raw) for (let l of r) for (let p of l) pts.push(p);
      let bb = get_bbox(pts);
      let text = opts.name===false ? null : seed+'.';
      return raw.map(r=>cleanup(reframe(r,20,text,bb)));
    },
  };
}

function bird_frames(seed,pose,colors,n,opts){
  let job = bird_frame_job(seed,pose,colors,n,opts);
  for (let i = 0; i < job.n; i++) job.step(i);
  return job.finish();
}

// the colours of a bird's palette, in the order the slider adds them
function bird_palette(seed,pose,colors){
  jsr = str_to_seed(seed);
  let params = generate_bird_params(pose);
  return colors ? generate_color_plan(params,colors,seed).swatches : [];
}

if (typeof module != "undefined"){
  module.exports = {main:bird_main,bird_frames,bird_frame_job,bird_palette,generate_color_plan,new_seed,generate_params:generate_bird_params,default_params:bird_default_params,bird,reframe,cleanup,draw_svg,binomen,str_to_seed};
  if (require.main === module) {
    let seed = undefined;
    let pose = undefined;
    let colors = 0;
    let name = true;
    let frame = true;
    let format = 'svg';
    let speed = 0.005;
    for (let i = 2; i < process.argv.length; i++){
      let a = process.argv[i];
      if (a == '--seed'){
        seed = process.argv[i+1];
      }else if (a == '--pose'){
        pose = process.argv[i+1];
      }else if (a == '--colors'){
        colors = +process.argv[i+1];
      }else if (a == '--no-name'){
        name = false;
      }else if (a == '--no-frame'){
        frame = false;
      }else if (a == '--format'){
        format = process.argv[i+1];
      }else if (a == '--speed'){
        if (process.argv[i+1] > 0)
          speed = speed / process.argv[i+1];
      }
    }
    let polylines = bird_main(seed,pose,colors,{name});
    if (format == 'svg'){
      console.log(draw_svg(polylines,{frame}));
    }else if (format == 'json'){
      console.log(JSON.stringify(polylines));
    }else if (format == 'smil'){
      console.log(draw_svg_anim(polylines,speed));
    }else if (format == 'csv'){
      console.log(polylines.map(x=>x.flat().join(',')).join('\n'));
    }else if (format == 'ps'){
      console.log(draw_ps(polylines));
    }
  }
}
