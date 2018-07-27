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
  console.log('data in handlers.users: ', data);
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

// Users - get
// Required data: phone
// Optional data: none
// TODO: Only let authenticated users access their own objects; don't let them access others'
handlers._users.get = function(data, callback) {
  // Check that phone is valid
  const phone = (typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10) ? data.queryStringObject.phone.trim() : false;
  if (phone) {
    // Get token from headers
    const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

    // Verify that token from headers is valid for phone
    handlers._tokens.verifyToken(token, phone, function(tokenIsValid) {
      if (tokenIsValid) {
        // Lookup the user
        _data.read('users', phone, function(err, data) {
          if (!err && data) {
            // Remove the hashed password from the user object before returning it
            delete data.hashedPassword;
            callback(200, data);
          } else {
            callback(404);
          }
        });
      } else {
        callback(403, { Error: 'Missing required token in header or token is invalid' });
      }
    })
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

// Users - put
// Required data: phone
// Optional data: firstName, lastName, password (at least one must be specified)
// TODO: Only authenticated user should update their own object, not modify anyone else's
handlers._users.put = function(data, callback) {
  // Check for required field
  const phone = (typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10) ? data.payload.phone.trim() : false;

  // Check for optional fields
  const firstName = (typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0) ? data.payload.firstName.trim() : false;
  const lastName = (typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0) ? data.payload.lastName.trim() : false;
  const password = (typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0) ? data.payload.password.trim() : false;

  // Error if phone is invalid
  if (phone) {
    if (firstName || lastName || password) {
      // Lookup the user
      _data.read('users', phone, function(err, userData) {
        if (!err && userData) {
          // Update fields as necessary
          if (firstName) {
            userData.firstName = firstName;
          }
          if (lastName) {
            userData.lastName = lastName;
          }
          if (password) {
            userData.hashedPassword = helpers.hash(password);
          }

          // Store the new updates
          _data.update('users', phone, userData, function(err) {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { Error: 'Could not update the user' });
            }
          });
        } else {
          callback(400, { Error: 'The specified user does not exist' });
        }
      });
    } else {
      callback(400, { Error: 'Missing fields to update' });
    }
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

// Delete user
// Required fields: phone
// Optional fields: none
// TODO: Authenticated user should be able to delete their own object, but no one else's
// TODO: Clean up (delete) any other data files associated with this user
handlers._users.delete = function(data, callback) {
  // Check that phone is valid
  const phone = (typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10) ? data.queryStringObject.phone.trim() : false;

  if (phone) {
    _data.read('users', phone, function(err, data) {
      if (!err && data) {
        _data.delete('users', phone, function(err) {
          if (!err) {
            callback(200);
          } else {
            callback(500, { Error: 'Could not delete the specified user' });
          }
        });
      } else {
        callback(400, { Error: 'Could not find the specified user' });
      }
    });
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

handlers.tokens = function(data, callback) {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  console.log('data in handlers.tokens: ', data);
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else {
    callback(405);
  }
};

handlers._tokens = {};

// Tokens - post
// Required data: phone, password
// Optional data: none
handlers._tokens.post = function(data, callback) {
  const phone = (typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10) ? data.payload.phone.trim() : false;
  const password = (typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0) ? data.payload.password.trim() : false;

  if (phone && password) {
    // Lookup the user who matches that phone number
    _data.read('users', phone, function(err, userData) {
      if (!err && userData) {
        // Hash the sent password and compare to password stored in user object
        const hashedPassword = helpers.hash(password);
        if (hashedPassword == userData.hashedPassword) {
          // Create a new token with random name, set expiration 1 hr in the future
          const tokenId = helpers.createRandomString(20);
          const expires = Date.now() + (1000 * 60 * 60);
          const tokenObject = {
            phone,
            id: tokenId,
            expires
          };

          // Store the token
          _data.create('tokens', tokenId, tokenObject, function(err) {
            if (!err) {
              callback(200, tokenObject);
            } else {
              callback(500, { Error: 'Could not create new token' });
            }
          });
        } else {
          callback(400, { Error: 'Password did not match specified user\'s stored password' })
        }
      } else {
        callback(400, { Error: 'Could not find the specified user' });
      }
    });
  } else {
    callback(400, { Error: 'Missing required fields' });
  }
};

// Tokens - get
// Required: id
// Optional: none
handlers._tokens.get = function(data, callback) {
  const id = (typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20) ? data.queryStringObject.id.trim() : false;
  if (id) {
    // Lookup the user
    _data.read('tokens', id, function(err, tokenData) {
      if (!err && tokenData) {
        callback(200, tokenData);
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, {Error: 'Missing required field'});
  }
};

// Tokens - put
// Required data: id, extend
// Optional data: none
handlers._tokens.put = function(data, callback) {
  const id = (typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20) ? data.payload.id.trim() : false;
  const extend = (typeof(data.payload.extend) == 'boolean' && data.payload.extend == true) ? true : false;
  if (id && extend) {
    _data.read('tokens', id, function(err, tokenData) {
      if (!err && tokenData) {
        // Check to make sure the token isn't already expired
        if (tokenData.expires > Date.now()) {
          // Set expiration an hour from now
          tokenData.expires = Date.now() + (1000 * 60 * 60);

          // Store the new updates
          _data.update('tokens', id, tokenData, function(err) {
            if (!err) {
              callback(200);
            } else {
              callback(500, { Error: 'Could not update token\'s expiration' });
            }
          })
        } else {
          callback(400, { Error: 'The token has already expired and cannot be extended' });
        }
      } else {
        callback(400, { Error: 'Specified token does not exist' });
      }
    })
  } else {
    callback(400, { Error: 'Missing required field(s) or field(s) are invalid' });
  }
};

// Token - delete
// Required data: id
// Optional data: none
handlers._tokens.delete = function(data, callback) {
  // Check that phone is valid
  const id = (typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20) ? data.queryStringObject.id.trim() : false;

  if (id) {
    _data.read('tokens', id, function(err, data) {
      if (!err && data) {
        _data.delete('tokens', id, function(err) {
          if (!err) {
            callback(200);
          } else {
            callback(500, { Error: 'Could not delete the specified token' });
          }
        });
      } else {
        callback(400, { Error: 'Could not find the specified token' });
      }
    });
  } else {
    callback(400, { Error: 'Missing required field' });
  }

};

// Verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = function(id, phone, callback) {
  // Lookup the token
  _data.read('tokens', id, function(err, tokenData) {
    if (!err && tokenData) {
      // Check that token is for the given user and has not expired
      if (tokenData.phone == phone && tokenData.expires > Date.now()) {
        callback(true);
      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  })
}

// Export the module
module.exports = handlers;
