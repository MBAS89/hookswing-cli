const fs = require('fs');
const path = require('path');
const os = require('os');

const configDir = path.join(os.homedir(), '.hookswing');
const configPath = path.join(configDir, 'config.json');

function readConfig() {
  try {
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function writeConfig(config) {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function clearConfig() {
  try {
    fs.unlinkSync(configPath);
  } catch {
    // ignore
  }
}

module.exports = { readConfig, writeConfig, clearConfig, configDir };
