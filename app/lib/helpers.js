/*
* Helpers for stuff
 */

// Dependencies
const crypto = require('crypto');
const config = require('./config');

// Container for helpers
const helpers = {};

helpers.hash = function(str) {
  if (typeof(str) == 'string' && str.length > 0) {
    const hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
    return hash;
  } else {
    return false;
  }
};

helpers.parseJsonToObject = function(str) {
  try {
    const obj = JSON.parse(str);
    return obj;
  } catch(err) {
    return {};
  }
};

helpers.createRandomString = function(strLength) {
  strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;
  if (strLength) {
    const possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';

    // Start the string
    let str = '';

    for (i = 1; i <= strLength; i++) {
      // Get a random character from the possibleCharacters string

      const randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
      // Append to the final string
      str += randomCharacter;
    }

    // Return the final string
    return str;
  } else {
    return false;
  }
}

// Export
module.exports = helpers;
