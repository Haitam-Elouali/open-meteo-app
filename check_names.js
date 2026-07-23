const fs = require('fs');
const content = fs.readFileSync('D:\\tmp\\world-cities-research.md', 'utf8');
const checks = ['Netherlands', 'Cape Verde', 'Cabo Verde', 'Republic of the Congo', 'Republic of Congo', 'North Macedonia'];
for (const name of checks) {
  console.log(name + ': ' + content.includes('"' + name + '": ['));
}
