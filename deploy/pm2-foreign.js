// `pm2 jlist` çıktısını stdin'den okur; verilen adlardan <current> DIŞINDAKİ bir klasörde
// çalışanları satır satır yazar. deploy.ps1 bunları startOrReload'dan önce siler: pm2 reload
// var olan sürecin cwd/script'ini değiştirmez, eski kurulumdan (Desktop\kroptos) devirde
// süreç eski yerde kalır ve yeni sürüm hiç açılmaz.
//
//   pm2 jlist | node pm2-foreign.js <current> <ad1> <ad2> ...
//
// PowerShell 5.1 ConvertFrom-Json, pm2 env'indeki USERNAME/username çiftinde düştüğü için
// ayrıştırma burada yapılır.
const path = require('path');

const [current, ...names] = process.argv.slice(2);
if (!current || names.length === 0) {
  console.error('kullanım: pm2 jlist | node pm2-foreign.js <current> <ad>...');
  process.exit(2);
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  // pm2 JSON'dan önce uyarı satırı basabiliyor.
  const start = input.indexOf('[');
  const list = start === -1 ? [] : JSON.parse(input.slice(start));
  const norm = (p) => path.resolve(p).toLowerCase() + path.sep;
  const base = norm(current);
  for (const proc of list) {
    if (!names.includes(proc.name)) continue;
    const cwd = proc.pm2_env && proc.pm2_env.pm_cwd;
    if (!cwd || !norm(cwd).startsWith(base)) console.log(proc.name);
  }
});
