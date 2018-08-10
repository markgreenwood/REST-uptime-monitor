/*
* Helpers for stuff
 */

// Dependencies
const crypto = require('crypto');
const querystring = require('querystring');
const https = require('https');
const path = require('path');
const fs = require('fs');

const config = require('./config');

// Container for helpers
const helpers = {};

helpers.hash = (str) => {
  if (typeof(str) == 'string' && str.length > 0) {
    const hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
    return hash;
  } else {
    return false;
  }
};

helpers.parseJsonToObject = (str) => {
  try {
    const obj = JSON.parse(str);
    return obj;
  } catch(err) {
    return {};
  }
};

helpers.createRandomString = (strLength) => {
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

helpers.sendTwilioSms = (phone, msg, callback) => {
  // Validate parameters
  phone = typeof(phone) == 'string' && phone.trim().length == 10 ? phone.trim(): false;
  msg = typeof(msg) == 'string' && msg.trim().length <= 1600 ? msg.trim() : false;
  if (phone && msg) {
    // Configure the request payload
    const payload = {
      From: config.twilio.fromPhone,
      To: '+1' + phone,
      Body: msg
    };

    // Stringify the payload
    const stringPayload = querystring.stringify(payload);

    // Configure the request details
    const requestDetails = {
      protocol: 'https:',
      hostname: 'api.twilio.com',
      method: 'POST',
      path: '/2010-04-01/Accounts/' + config.twilio.accountSid + '/Messages.json',
      auth: config.twilio.accountSid + ':' + config.twilio.authToken,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayload)
      }
    };

    // Instantiate the request object
    const req = https.request(requestDetails, (res) => {
      // Grab status of sent request
      const status = res.statusCode;

      // Callback successfully if request went through
      if (status == 200 || status == 201) {
        callback(false);
      } else {
        callback('Status code returned was ' + status);
      }
    });

    // Bind to the error event so it doesn't get thrown
    req.on('error', (e) => {
      callback(e);
    });

    // Add the payload
    req.write(stringPayload);

    // End the request
    req.end();
  } else {
    callback('Given parameters missing or invalid');
  }
};

// Get the string content of a template
helpers.getTemplate = (templateName, data, callback) => {
  templateName = typeof(templateName) == 'string' && templateName.length > 0 ? templateName : false;
  data = typeof(data) == 'object' && data !== null ? data : {};

  if (templateName) {
    const templateDir = path.join(__dirname, '/../templates/');
    fs.readFile(templateDir + templateName + '.html', 'utf8', (err, str) => {
      if (!err && str && str.length > 0) {
        const finalStr = helpers.interpolate(str, data);
        callback(false, finalStr);
      } else {
        callback('No template found');
      }
    })
  } else {
    callback('A valid template name was not specified');
  }
};

// Add the universal header and footer to a string and pass provided data object to header and footer for interpolation
helpers.addUniversalTemplates = (str, data, callback) => {
  str = typeof(str) == 'string' && str.length > 0 ? str : '';
  data = typeof(data) == 'object' && data !== null ? data : {};

  // Get the header
  helpers.getTemplate('_header', data, (err, headerString) => {
    if (!err && headerString) {
      helpers.getTemplate('_footer', data, (err, footerString) => {
        if (!err && footerString) {
          const fullString = headerString + str + footerString;
          callback(false, fullString);
        } else {
          callback('Could not find footer template');
        }
      })

    } else {
      callback('Could not find header template');
    }
  })
};

// Take a given string and a data object and find/replace all the keys within it
helpers.interpolate = (str, data) => {
  str = typeof(str) == 'string' && str.length > 0 ? str : '';
  data = typeof(data) == 'object' && data !== null ? data : {};

  // Add template globals to the data object prepending their key name with 'global'
  for (let keyName in config.templateGlobals) {
    if (config.templateGlobals.hasOwnProperty(keyName)) {
      data['global.' + keyName] = config.templateGlobals[keyName];
    }
  }

  // For each key in data object, insert its value into the string at the corresponding placeholder
  for (let key in data) {
    if (data.hasOwnProperty(key) && typeof(data[key]) == 'string') {
      const replace = data[key];
      const find = '{' + key + '}';
      str = str.replace(find, replace);
    }
  }

  return str;
};

// Export
module.exports = helpers;
