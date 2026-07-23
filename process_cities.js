const fs = require('fs');
const path = require('path');

const citiesFile = path.join(__dirname, 'cities5000', 'cities5000.txt');
const countryInfoFile = path.join(__dirname, 'countryInfo.txt');
const outputFile = 'D:\\tmp\\world-cities-research.md';

// Parse countryInfo.txt
const countryMap = {};
const countryLines = fs.readFileSync(countryInfoFile, 'utf8').split('\n');
for (const line of countryLines) {
  if (line.startsWith('#') || line.trim() === '') continue;
  const parts = line.split('\t');
  if (parts.length < 6) continue;
  const countryCode = parts[0].trim();
  const countryName = parts[4].trim();
  if (countryCode && countryName) {
    countryMap[countryCode] = countryName;
  }
}

// Fix country names to better match user expectations
const nameOverrides = {
  'Palestinian Territory': 'Palestine',
  'Vatican': 'Vatican City',
  'The Netherlands': 'Netherlands',
  'Cabo Verde': 'Cape Verde',
  'Republic of the Congo': 'Republic of Congo',
  'Ivory Coast': 'Ivory Coast',
  'Czechia': 'Czechia',
};

// Parse cities5000.txt
const citiesByCountry = {};
const lines = fs.readFileSync(citiesFile, 'utf8').split('\n');
for (const line of lines) {
  if (line.trim() === '') continue;
  const parts = line.split('\t');
  if (parts.length < 15) continue;
  const countryCode = parts[8].trim();
  const asciiname = parts[2].trim();
  const name = parts[1].trim();
  const population = parseInt(parts[14], 10) || 0;
  const featureCode = parts[7].trim();

  const cityName = asciiname || name;
  if (!cityName || !countryCode) continue;

  if (!citiesByCountry[countryCode]) {
    citiesByCountry[countryCode] = [];
  }
  citiesByCountry[countryCode].push({ name: cityName, population, featureCode });
}

// Sort each country by population descending
const excludedCodes = new Set(['AQ']); // Antarctica
const result = {};

for (const [code, cities] of Object.entries(citiesByCountry)) {
  if (excludedCodes.has(code) || !countryMap[code]) continue;

  cities.sort((a, b) => {
    if (b.population !== a.population) return b.population - a.population;
    const aIsCapital = a.featureCode.startsWith('PPLA') ? 1 : 0;
    const bIsCapital = b.featureCode.startsWith('PPLA') ? 1 : 0;
    return bIsCapital - aIsCapital;
  });

  const selected = cities.slice(0, Math.min(20, cities.length));
  let countryName = countryMap[code];
  if (nameOverrides[countryName]) {
    countryName = nameOverrides[countryName];
  }
  if (selected.length > 0) {
    result[countryName] = selected.map(c => c.name);
  }
}

// Generate JavaScript object as a string
const linesOut = [];
linesOut.push('// World Cities Database');
linesOut.push('// Source: GeoNames (https://download.geonames.org/export/dump/)');
linesOut.push('// License: Creative Commons Attribution 4.0');
linesOut.push('// Cities with population > 5000 or administrative capitals');
linesOut.push('const worldCities = {');
const countryNames = Object.keys(result).sort();
for (const country of countryNames) {
  const cities = result[country];
  const uniqueCities = [...new Set(cities)];
  const citiesStr = uniqueCities.map(c => `    "${c}"`).join(',\n');
  linesOut.push(`  "${country}": [\n${citiesStr}\n  ],`);
}
linesOut.push('};');
linesOut.push('');
linesOut.push('module.exports = worldCities;');

fs.writeFileSync(outputFile, linesOut.join('\n'), 'utf8');
console.log(`Written ${countryNames.length} countries to ${outputFile}`);

// Print some stats
let atLeast10 = 0, lessThan5 = 0, exactly = {};
for (const [name, cities] of Object.entries(result)) {
  if (cities.length >= 10) atLeast10++;
  if (cities.length < 5) lessThan5++;
  if (!exactly[cities.length]) exactly[cities.length] = [];
  exactly[cities.length].push(name);
}
console.log(`Countries with >=10 cities: ${atLeast10}`);
console.log(`Countries with <5 cities: ${lessThan5}`);
console.log('Countries with <5 cities: ' + (exactly[1] || []).join(', ') + ' | ' + (exactly[2] || []).join(', ') + ' | ' + (exactly[3] || []).join(', ') + ' | ' + (exactly[4] || []).join(', '));
