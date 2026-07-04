// RGB <-> Lab conversion helpers (D65 illuminant, sRGB)

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToXyz(r, g, b) {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  const z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;
  return [x, y, z];
}

function xyzToLab(x, y, z) {
  // D65 reference white
  const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
  const fx = labF(x / Xn);
  const fy = labF(y / Yn);
  const fz = labF(z / Zn);
  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);
  return [L, a, b];
}

function labF(t) {
  const delta = 6 / 29;
  return t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;
}

function rgbToLab(r, g, b) {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(hex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function labDistance(lab1, lab2) {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

function rgbDistance(rgb1, rgb2) {
  const dr = rgb1[0] - rgb2[0];
  const dg = rgb1[1] - rgb2[1];
  const db = rgb1[2] - rgb2[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

const DEG2RAD = Math.PI / 180;

// CIE94 color difference (graphic arts weighting: kL=kC=kH=1, K1=0.045, K2=0.015).
function cie94Distance(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const dL = L1 - L2;
  const dC = C1 - C2;
  const da = a1 - a2;
  const db = b1 - b2;
  const dH2 = Math.max(0, da * da + db * db - dC * dC);

  const K1 = 0.045, K2 = 0.015;
  const SL = 1;
  const SC = 1 + K1 * C1;
  const SH = 1 + K2 * C1;

  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH2 / (SH * SH)));
}

// CIEDE2000 color difference (Sharma et al. 2005 reference implementation).
function ciede2000Distance(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const avgL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;
  const avgC7 = avgC ** 7;
  const G = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + 25 ** 7)));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const h1p = C1p === 0 ? 0 : (Math.atan2(b1, a1p) / DEG2RAD + 360) % 360;
  const h2p = C2p === 0 ? 0 : (Math.atan2(b2, a2p) / DEG2RAD + 360) % 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * DEG2RAD);

  const avgLp = (L1 + L2) / 2;
  const avgCp = (C1p + C2p) / 2;

  let avghp;
  if (C1p * C2p === 0) {
    avghp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) > 180) {
    avghp = (h1p + h2p + 360) < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  } else {
    avghp = (h1p + h2p) / 2;
  }

  const T = 1
    - 0.17 * Math.cos((avghp - 30) * DEG2RAD)
    + 0.24 * Math.cos((2 * avghp) * DEG2RAD)
    + 0.32 * Math.cos((3 * avghp + 6) * DEG2RAD)
    - 0.20 * Math.cos((4 * avghp - 63) * DEG2RAD);

  const dTheta = 30 * Math.exp(-(((avghp - 275) / 25) ** 2));
  const avgCp7 = avgCp ** 7;
  const Rc = 2 * Math.sqrt(avgCp7 / (avgCp7 + 25 ** 7));
  const Sl = 1 + (0.015 * (avgLp - 50) ** 2) / Math.sqrt(20 + (avgLp - 50) ** 2);
  const Sc = 1 + 0.045 * avgCp;
  const Sh = 1 + 0.015 * avgCp * T;
  const Rt = -Math.sin(2 * dTheta * DEG2RAD) * Rc;

  const termL = dLp / Sl;
  const termC = dCp / Sc;
  const termH = dHp / Sh;

  return Math.sqrt(termL * termL + termC * termC + termH * termH + Rt * termC * termH);
}

// Converts CIELAB to the DIN99o uniform color space.
function labToDin99o(lab) {
  const [L, a, b] = lab;
  const angle = 26 * DEG2RAD;
  const e = a * Math.cos(angle) + b * Math.sin(angle);
  const f = 0.83 * (-a * Math.sin(angle) + b * Math.cos(angle));
  const G = Math.sqrt(e * e + f * f);
  const C99o = Math.log(1 + 0.075 * G) / 0.0435;
  const h99o = Math.atan2(f, e) + angle;

  const L99o = 303.67 * Math.log(1 + 0.0039 * L);
  const a99o = C99o * Math.cos(h99o);
  const b99o = C99o * Math.sin(h99o);
  return [L99o, a99o, b99o];
}

function din99oDistance(lab1, lab2) {
  return labDistance(labToDin99o(lab1), labToDin99o(lab2));
}

const DISTANCE_METHODS = {
  euclideanRgb: (rgb1, lab1, rgb2, lab2) => rgbDistance(rgb1, rgb2),
  euclideanLab: (rgb1, lab1, rgb2, lab2) => labDistance(lab1, lab2),
  cie94: (rgb1, lab1, rgb2, lab2) => cie94Distance(lab1, lab2),
  ciede2000: (rgb1, lab1, rgb2, lab2) => ciede2000Distance(lab1, lab2),
  din99o: (rgb1, lab1, rgb2, lab2) => din99oDistance(lab1, lab2),
};

function colorDistance(method, rgb1, lab1, rgb2, lab2) {
  const fn = DISTANCE_METHODS[method] || DISTANCE_METHODS.euclideanLab;
  return fn(rgb1, lab1, rgb2, lab2);
}

window.ColorSpace = {
  rgbToLab,
  hexToRgb,
  labDistance,
  rgbDistance,
  colorDistance,
  DISTANCE_METHODS: Object.keys(DISTANCE_METHODS),
};
