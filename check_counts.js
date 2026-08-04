const fs = require('fs');
const data = fs.readFileSync('D:/Open-Meteo/cities5000/cities5000.txt', 'utf8');
const lines = data.split('\n');
const counts = {};
for (const line of lines) {
  if (!line) continue;
  const p = line.split('\t');
  if (p.length < 15) continue;
  const cc = p[8].trim();
  if (counts[cc]) counts[cc] = (counts[cc] || 0) + 1;
  else counts[cc] = 1;
}
for (const code of ['AD','SM','MC','VA','PS','DJ','XK','AM','BY','KP','SO','EH']) {
  console.log(code + ': ' + (counts[code] || 0));
}
console.log('Total codes: ' + Object.keys(counts).length);
