const fs = require('fs');

// Read the JSON file
const data = fs.readFileSync('src/fakedata.json', 'utf8');
const jsonData = JSON.parse(data);

// Get the first 5 Vitality players (IDs 100101-100105)
const vitalityPlayers = jsonData.teamPlayers.slice(0, 5);

// Create duplicates with IDs 1-5
const duplicatedPlayers = vitalityPlayers.map((player, index) => ({
  ...player,
  id: index + 1
}));

// Insert the duplicated players at the beginning of the array
jsonData.teamPlayers.unshift(...duplicatedPlayers);

// Write back to file
fs.writeFileSync('src/fakedata.json', JSON.stringify(jsonData, null, 2));

console.log('Successfully duplicated Vitality team members with IDs 1-5');