const fs = require('fs');
const d = fs.readFileSync('src/pages/dashboard/dashboard.js', 'utf8');
const m = d.match(/"Morocco":\s*\[([\s\S]*?)\],/);
if (m) {
  const cities = [];
  const regex = /name:\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(m[1])) !== null) {
    cities.push(match[1]);
  }
  console.log('Count:', cities.length);
  console.log(cities.join('\n'));
}
