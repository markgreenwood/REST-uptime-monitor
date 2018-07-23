/*
* These are the request handlers
 */

// Dependencies
const _data = require('./data');
const helpers = require('./helpers');

// Define the handlers
const handlers = {};

handlers.ping = (data, callback) => {
  callback(200);
};

handlers.notFound = (data, callback) => {
  callback(404);
};

handlers.users = function(data, callback) {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for the users submethods
handlers._users = {};

// Users - post
// Required fields: firstName, lastName, phone, password, tosAgreement
// Optional fields: none
handlers._users.post = function(data, callback) {
  // Check that all required fields are filled out
  const firstName = (typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0) ? data.payload.firstName.trim() : false;
  const lastName = (typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0) ? data.payload.lastName.trim() : false;
  const phone = (typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10) ? data.payload.phone.trim() : false;
  const password = (typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0) ? data.payload.password.trim() : false;
  const tosAgreement = (typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true) ? true : false;

  if (firstName && lastName && phone && password && tosAgreement) {
    // Make sure the user doesn't already exist
    _data.read('users', phone, function(err, data) {
      if (err) {
        // Hash the password
        const hashedPassword = helpers.hash(password);

        if (hashedPassword) {
          // Create the user object
          const userObject = {
            firstName,
            lastName,
            phone,
            hashedPassword,
            tosAgreement : true
          };

          // Store the user
          _data.create('users', phone, userObject, function(err) {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { Error: 'Could not create the new user.' });
            }
          });
        } else {
          callback(500, { Error: 'Could not hash the user\'s password' });
        }
      } else {
        // User already exists
        callback(400, { Error: 'User with that phone already exists.' });
      }
    });
  } else {
    callback(400, { Error : 'Missing required fields' });
  }
};

handlers._users.get = function(data, callback) {};

handlers._users.put = function(data, callback) {};

handlers._users.delete = function(data, callback) {};

// Export the module
module.exports = handlers;
