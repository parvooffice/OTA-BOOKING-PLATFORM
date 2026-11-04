import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const properties = [
  { slug: "puri", place: "PURI · THE COAST", sky: "#e9ad66", sea: "#628c87", land: "#a64d37", detail: "#f1d59c", type: "coast" },
  { slug: "chilika", place: "CHILIKA · THE LAGOON", sky: "#d9b978", sea: "#709b96", land: "#7e9475", detail: "#f3e1b7", type: "lagoon" },
  { slug: "gopalpur", place: "GOPALPUR · SOUTH COAST", sky: "#d99465", sea: "#587c78", land: "#b76443", detail: "#f3d293", type: "coast" },
  { slug: "similipal", place: "SIMILIPAL · THE FOREST", sky: "#d6bd83", sea: "#6f815e", land: "#53644b", detail: "#e7d3a6", type: "forest" }
];

function art(property: (typeof properties)[number], variant: number, hero = false) {
  const offset = variant * 34;
  const width = 1600;
  const height = 1200;
  const horizon = 690 - variant * 26;
  const terrain = property.type === "forest"
    ? `<path d="M0 ${horizon + 100} Q260 ${horizon - 15} 490 ${horizon + 93} T930 ${horizon + 25} T1320 ${horizon + 92} T1600 ${horizon + 6} V1200 H0Z" fill="${property.land}"/><path d="M0 ${horizon + 200} Q350 ${horizon + 32} 700 ${horizon + 188} T1250 ${horizon + 140} T1600 ${horizon + 110} V1200 H0Z" fill="#394c3c"/>`
    : `<path d="M0 ${horizon + 120} Q340 ${horizon + 30} 690 ${horizon + 104} T1280 ${horizon + 54} T1600 ${horizon + 103} V1200 H0Z" fill="${property.sea}"/><path d="M0 ${horizon + 245} Q300 ${horizon + 168} 700 ${horizon + 240} T1260 ${horizon + 198} T1600 ${horizon + 230} V1200 H0Z" fill="#426f6d"/><path d="M0 ${horizon + 370} Q450 ${horizon + 318} 820 ${horizon + 377} T1600 ${horizon + 336} V1200 H0Z" fill="${property.land}"/>`;
  const palms = property.type === "forest"
    ? Array.from({ length: 8 }, (_, i) => { const x = 150 + i * 190 + (variant % 2) * 35; const y = 685 + (i % 3) * 38; const scale = .72 + (i % 4) * .12; return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 0 Q-25 -100 -13 -235" stroke="#352e24" stroke-width="18" fill="none"/><path d="M-13 -232 Q-130 -300 -172 -246 Q-87 -253 -18 -215 Q-100 -223 -111 -168 Q-50 -205 -9 -204 Q34 -299 109 -272 Q47 -255 7 -205 Q111 -236 159 -180 Q82 -193 2 -188Z" fill="${i % 2 ? "#6f815e" : "#53644b"}"/></g>`; }).join("")
    : Array.from({ length: 4 }, (_, i) => { const x = 100 + i * 430 + offset; const y = 790 + (i % 2) * 60; const scale = .7 + (i % 3) * .18; return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 0 Q22 -155 13 -340" stroke="#42342b" stroke-width="15" fill="none"/><path d="M12 -335 Q-132 -418 -174 -342 Q-97 -353 -5 -315 Q-105 -309 -120 -255 Q-57 -291 8 -292 Q80 -422 163 -370 Q93 -350 23 -291 Q128 -318 181 -250 Q92 -271 10 -270Z" fill="#394b3e"/><path d="M0 0 Q-30 90 -44 169" stroke="#42342b" stroke-width="18" fill="none"/></g>`; }).join("");
  const waterMarks = Array.from({ length: 12 }, (_, i) => `<path d="M${80 + i * 136} ${horizon + 230 + (i % 3) * 58} q45 -14 96 0" stroke="${property.detail}" stroke-opacity=".4" stroke-width="4" fill="none"/>`).join("");
  const birdMarks = Array.from({ length: 5 }, (_, i) => `<path d="M${990 + i * 56} ${325 + (i % 2) * 28} q16 -17 32 0 q16 -17 32 0" stroke="#5c4635" stroke-width="4" fill="none"/>`).join("");
  const sunX = 1245 - variant * 74;
  const sunY = 315 + variant * 17;
  const label = hero ? `<g transform="translate(94 1020)"><text font-family="Georgia,serif" font-size="34" letter-spacing="7" fill="#fff8e7">A FIELD NOTE FROM ODISHA</text><path d="M0 22h260" stroke="#f0c56e" stroke-width="3"/></g>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${property.sky}"/><stop offset="1" stop-color="${property.detail}"/></linearGradient><radialGradient id="wash"><stop stop-color="#fff4d8" stop-opacity=".46"/><stop offset="1" stop-color="#fff4d8" stop-opacity="0"/></radialGradient><pattern id="grain" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="2" cy="4" r="1.2" fill="#36271d" opacity=".08"/><circle cx="22" cy="30" r="1" fill="#36271d" opacity=".07"/></pattern></defs><rect width="1600" height="1200" fill="url(#sky)"/><ellipse cx="${sunX}" cy="${sunY}" rx="400" ry="350" fill="url(#wash)"/><circle cx="${sunX}" cy="${sunY}" r="94" fill="#f4d790" opacity=".92"/><path d="M0 ${horizon} Q380 ${horizon - 40} 800 ${horizon + 4} T1600 ${horizon - 20} V1200 H0Z" fill="${property.type === "forest" ? "#8d9871" : "#e5c88f"}"/>${terrain}${property.type === "forest" ? "" : waterMarks}${palms}${property.type === "forest" ? "" : birdMarks}<rect width="1600" height="1200" fill="url(#grain)"/>${label}<g transform="translate(1268 1080) rotate(-7)"><rect width="244" height="52" fill="#f5f0e7" opacity=".88"/><text x="122" y="34" text-anchor="middle" font-family="Georgia,serif" font-size="16" letter-spacing="2" fill="#594638">${property.place}</text></g></svg>`;
}

async function main() {
  const root = path.join(process.cwd(), "public", "properties");
  const brand = path.join(process.cwd(), "public", "brand");
  await mkdir(path.join(brand, "patterns"), { recursive: true });
  for (const property of properties) {
    const folder = path.join(root, property.slug);
    await mkdir(path.join(folder, "gallery"), { recursive: true });
    await mkdir(path.join(folder, "thumbs"), { recursive: true });
    for (let variant = 0; variant < 3; variant++) {
      const svg = Buffer.from(art(property, variant, variant === 0));
      const output = variant === 0 ? path.join(folder, "hero.png") : path.join(folder, "gallery", `0${variant}.png`);
      const width = variant === 0 ? 1800 : 1400;
      await sharp(svg).resize(width).png({ compressionLevel: 9 }).toFile(output);
      await sharp(svg).resize(600, 450, { fit: "cover" }).png({ compressionLevel: 9 }).toFile(path.join(folder, "thumbs", `0${variant + 1}.png`));
    }
  }
  const logo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400"><rect width="1200" height="400" fill="#f5f0e7"/><g transform="translate(80 40) scale(2.65)" fill="none" stroke="#a64d37"><circle cx="60" cy="60" r="50" stroke-width="1.5"/><circle cx="60" cy="60" r="39" stroke-width=".9" stroke-dasharray="1 3"/><circle cx="60" cy="60" r="7" fill="#a64d37" stroke="none"/>${Array.from({ length: 12 }, (_, i) => `<g transform="rotate(${i * 30} 60 60)"><path d="M60 12V53" stroke-width="1.3"/><circle cx="60" cy="21" r="2.2" fill="#d4a23d" stroke="none"/><path d="M56 40 60 36 64 40 60 44z" fill="#a64d37" stroke="none"/></g>`).join("")}</g><text x="540" y="176" fill="#2a211a" font-family="Georgia,serif" font-size="70">Odisha Retreat</text><text x="546" y="231" fill="#a64a36" font-family="Arial,sans-serif" font-size="18" letter-spacing="8">FOUR STAYS, HELD CLOSE</text><path d="M542 260h560" stroke="#d4a23d" stroke-width="3"/><text x="546" y="318" fill="#6a5c4e" font-family="Georgia,serif" font-size="24">ଓଡ଼ିଶା · A little closer to this place.</text></svg>`);
  await sharp(logo).png({ compressionLevel: 9 }).toFile(path.join(brand, "logo.png"));
  const pattern = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="180" viewBox="0 0 1200 180"><rect width="1200" height="180" fill="#f5f0e7"/><path d="M0 10H1200M0 170H1200" stroke="#a64d37" stroke-width="3"/><g fill="none" stroke="#a64d37" stroke-width="3">${Array.from({ length: 20 }, (_, i) => { const x = 24 + i * 60; return `<path d="M${x} 90l30-54 30 54-30 54zM${x + 15} 90l15-27 15 27-15 27z"/><path d="M${x + 30} 30v120" stroke="#d4a23d" stroke-width="2"/>`; }).join("")}</g><circle cx="24" cy="90" r="8" fill="#d4a23d"/></svg>`);
  await sharp(pattern).png({ compressionLevel: 9 }).toFile(path.join(brand, "patterns", "sambalpuri-border.png"));
  console.log("Generated 12 local PNG illustration placeholders. Replace them with property photography before launch.");
}

void main();
