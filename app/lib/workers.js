/*
 * Worker-related tasks
 */

// Dependencies
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const url = require('url');

const _data = require('./data');
const helpers = require('./helpers');

const workers = {};

// Gather all checks
workers.gatherAllChecks = function() {
  // Get all the checks that exist in the system
  _data.list('checks', function(err, checks) {
    if (!err && checks && checks.length > 0) {
      checks.forEach(function(check) {
        // Read in the check data
        _data.read('checks', check, function(err, originalCheckData) {
          if (!err && originalCheckData) {
            // Pass data to check validator
            workers.validateCheckData(originalCheckData);
          } else {
            console.log('Error reading one of the check\'s data');
          }
        })
      });
    } else {
      console.log('Error: Could not find any checks to process');
    }
  });
};

// Sanity checking the check data
workers.validateCheckData = function(originalCheckData) {
  originalCheckData = typeof(originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : {};
  originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
  originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 10 ? originalCheckData.userPhone.trim() : false;
  originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['http', 'https'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
  originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
  originalCheckData.method = typeof(originalCheckData.method) == 'string' && ['get', 'post', 'put', 'delete'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false;
  originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;
  originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;

  // Set the keys that may not be set if workers have never seen this check before
  originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
  originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked % 1 === 0 && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

  // If all the checks pass, pass data along to the next step in the process
  if (originalCheckData.id &&
      originalCheckData.userPhone &&
      originalCheckData.protocol &&
      originalCheckData.url &&
      originalCheckData.method &&
      originalCheckData.successCodes &&
      originalCheckData.timeoutSeconds) {
    workers.performCheck(originalCheckData);
  } else {
    console.log('Error: One of the checks is not properly formatted. Skipping it.');
  }
};

// Perform the check, send the originalCheckData and the outcome of the check to the next step in the process
workers.performCheck = function(originalCheckData) {
  // Prepare initial check outcome
  const checkOutcome = {
    error: false,
    responseCode: false
  };

  // Mark that outcome has not been sent yet
  let outcomeSent = false;

  // Parse the hostname and path out of originalCheckData
  const parsedUrl = url.parse(originalCheckData.protocol + '://' + originalCheckData.url, true);
  const hostName = parsedUrl.hostname;
  const path = parsedUrl.path; // using 'path' and not 'pathname' because we want query string

  // Construct request
  const requestDetails = {
    protocol: originalCheckData.protocol + ':',
    hostName,
    method: originalCheckData.method.toUpperCase(),
    path,
    timeout: originalCheckData.timeoutSeconds * 1000
  };

  // Instantiate request object using either http or https module
  const _moduleToUse = originalCheckData.protocol == 'http' ? http : https;
  const req = _moduleToUse.request(requestDetails, function(res) {
    // Grab the status of the sent request
    const status = res.statusCode;

    // Update the checkOutcome and pass the data along
    checkOutcome.responseCode = status;
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  // Bind to the error event so it doesn't get thrown
  req.on('error', function(e) {
    // Update the checkOutcome and pass the data along
    checkOutcome.error = {
      error: true,
      value: e
    };

    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  // Bind to the timeout event
  req.on('timeout', function(e) {
    // Update the checkOutcome and pass the data along
    checkOutcome.error = {
      error: true,
      value: 'timeout'
    };

    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  // End the request
  req.end();
};

// Process the check outcome, update the check data, trigger an alert if needed
// Special logic for accommodating a check that has never been tested before (don't want to alert)
workers.processCheckOutcome = function(originalCheckData, checkOutcome) {
  // Decide if the check is considered 'up' or 'down'
  const state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';

  // Decide if alert is warranted
  const alertWarranted = originalCheckData.lastChecked && originalCheckData.state != state;

  // Update the check data
  const newCheckData = originalCheckData;
  newCheckData.state = state;
  newCheckData.lastChecked = Date.now();

  // Save the updates
  _data.update('checks', newCheckData.id, newCheckData, function(err) {
    if (!err) {
      if (alertWarranted) {
        workers.alertUserToStatusChange(newCheckData);
      } else {
        console.log('Check outcome has not changed, no alert needed');
      }
    } else {
      console.log('Error trying to save updates to one of the checks');
    }
  })
};

// Alert user to change in check status
workers.alertUserToStatusChange = function(newCheckData) {
  const msg = 'Alert: Your check for ' + newCheckData.method.toUpperCase() + ' ' + newCheckData.protocol + '://' + newCheckData.url + ' is currently ' + newCheckData.state;
  helpers.sendTwilioSms(newCheckData.userPhone, msg, function(err) {
    if (!err) {
      console.log('Success: user was alerted to status change in their check, via SMS: ', msg);
    } else {
      console.log('Error: could not send SMS alert to user who had a state change in their check');
    }
  });
};

// Timer to execute the worker process once per minute
workers.loop = function() {
  setInterval(function() {
    workers.gatherAllChecks();
  }, 1000 * 60);
};

// Init function
workers.init = function() {
  // Execute all the checks
  workers.gatherAllChecks();

  // Call a loop so the checks continue to execute on their own
  workers.loop();
};

// Export the module
module.exports = workers;
