const axios = require('axios');
const { readConfig } = require('./config');

function getApi() {
  const config = readConfig();
  const baseURL = process.env.HOOKSWING_API_URL || config?.apiUrl || 'https://hookswing.com';
  const token = config?.accessToken;

  return axios.create({
    baseURL: `${baseURL}/api`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

module.exports = { getApi };
