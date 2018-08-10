/*
* These are the request handlers
 */

// Dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');

// Define the handlers
const handlers = {};

/*
 * HTML API handlers
 */

// Index handler
handlers.index = (data, callback) => {
  // Reject any request that isn't a GET
  if (data.method == 'get') {
    // Prepare data for interpolation
    const templateData = {
      'head.title': 'This is the title',
      'head.description': 'This is the meta description',
      'body.title': 'Hello templated world!',
      'body.class': 'index'
    };

    // Read in a template as a string
    helpers.getTemplate('index', templateData, (err, str) => {
      if (!err && str) {
        // Add the universal templates
        helpers.addUniversalTemplates(str, templateData, (err, str) => {
          if (!err && str) {
            callback(200, str, 'html');
          } else {
            callback(500, undefined, 'html');
          }
        });
      } else {
        callback(500, undefined, 'html');
      }
    });
  } else {
    callback(405, undefined, 'html');
  }
};

// Favicon
handlers.favicon = (data, callback) => {
  // Reject anything that isn't a GET
  if (data.method == 'get') {
    // Read in the favicon data
    helpers.getStaticAsset('favicon.ico', (err, data) => {
      if (!err && data) {
        callback(200, data, 'favicon');
      } else {
        callback(500);
      }
    });
  } else {
    callback(405);
  }
};

// Public assets
handlers.public = (data, callback) => {
  // Reject anything that isn't a GET
  if (data.method == 'get') {
    // Get the filename being requested
    const trimmedAssetName = data.trimmedPath.replace('public/', '');

    console.log('trimmedAssetName ', trimmedAssetName);

    if (trimmedAssetName.length > 0) {
      helpers.getStaticAsset(trimmedAssetName, (err, data) => {
        if (!err && data) {
          // Determine the content type, default to plain text
          let contentType = 'plain';

          if (trimmedAssetName.indexOf('.css') > -1) {
            contentType = 'css';
          }

          if (trimmedAssetName.indexOf('.png') > -1) {
            contentType = 'png';
          }

          if (trimmedAssetName.indexOf('.jpg') > -1) {
            contentType = 'jpg';
          }

          if (trimmedAssetName.indexOf('.ico') > -1) {
            contentType = 'favicon';
          }

          console.log('contentType ', contentType);

          callback(200, data, contentType);
        } else {
          callback(404);
        }
      });
    } else {
      callback(404);
    }
  } else {
    callback(405);
  }
};

/*
 * JSON API handlers
 */

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

// Users - get
// Required data: phone
// Optional data: none
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
      // Get token from headers
      const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

      // Verify that token from headers is valid for phone
      handlers._tokens.verifyToken(token, phone, function(tokenIsValid) {
        if (tokenIsValid) {
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
          callback(403, { Error: 'Missing required token in header or token is invalid' });
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
// TODO: Clean up (delete) any other data files associated with this user
handlers._users.delete = function(data, callback) {
  // Check that phone is valid
  const phone = (typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10) ? data.queryStringObject.phone.trim() : false;

  if (phone) {
    // Get token from headers
    const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

    // Verify that token from headers is valid for phone
    handlers._tokens.verifyToken(token, phone, function(tokenIsValid) {
      if (tokenIsValid) {
        _data.read('users', phone, function(err, userData) {
          if (!err && userData) {
            _data.delete('users', phone, function(err) {
              if (!err) {
                // Delete each of the checks associated with the user
                const userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                const checksToDelete = userChecks.length;
                if (checksToDelete > 0) {
                  let checksDeleted = 0;
                  let deletionErrors = false;
                  // Loop through the checks
                  userChecks.forEach(function(checkId) {
                    _data.delete('checks', checkId, function(err) {
                      if (err) {
                        deletionErrors = true;
                      }
                      checksDeleted++;
                      if (checksDeleted == checksToDelete) {
                        if (!deletionErrors) {
                          callback(200);
                        } else {
                          callback(500, { Error: 'Errors encountered while attempting to delete all user\'s checks. Not all checks may have been deleted successfully.' });
                        }
                      }
                    })
                  })
                } else {
                  callback(200);
                }
              } else {
                callback(500, { Error: 'Could not delete the specified user' });
              }
            });
          } else {
            callback(400, { Error: 'Could not find the specified user' });
          }
        });
      } else {
        callback(403, { Error: 'Missing required token in header or token is invalid' });
      }
    });
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

handlers.tokens = function(data, callback) {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
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

handlers.checks = function(data, callback) {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback);
  } else {
    callback(405);
  }
};

handlers._checks = {};

// Checks - post
// Required data: protocol, url, method, successCodes, timeoutSeconds
// Optional data: none
handlers._checks.post = function(data, callback) {
  // Validate inputs
  const protocol = (typeof(data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1) ? data.payload.protocol : false;
  const url = (typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0) ? data.payload.url.trim() : false;
  const method = (typeof(data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1) ? data.payload.method : false;
  const successCodes = (typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0) ? data.payload.successCodes : false;
  const timeoutSeconds = (typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5) ? data.payload.timeoutSeconds : false;

  if (protocol && url && method && successCodes && timeoutSeconds) {
    // Check that user provided token, look up user with token
    // Get token from headers
    const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    _data.read('tokens', token, function(err, tokenData) {
      if (!err && tokenData) {
        // Get user's phone
        const userPhone = tokenData.phone;
        _data.read('users', userPhone, function(err, userData) {
          if (!err && userData) {
            // Identify which checks user already has
            const userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
            // Verify user has < max number of checks per user
            if (userChecks.length < config.maxChecks) {
              // Create a random id for the check
              const checkId = helpers.createRandomString(20);
              // Create the check object, and include the user's phone
              const checkObject = {
                id: checkId,
                userPhone,
                protocol,
                url,
                method,
                successCodes,
                timeoutSeconds
              };
              _data.create('checks', checkId, checkObject, function(err) {
                if (!err) {
                  // Add the checkId to the user's object
                  userData.checks = userChecks;
                  userData.checks.push(checkId);

                  // Save the new user data
                  _data.update('users', userPhone, userData, function(err) {
                    if (!err) {
                      callback(200, checkObject);
                    } else {
                      callback(500, { Error: 'Could not update the user with the new check' });
                    }
                  });
                } else {
                  callback(500, { Error: 'Could not create the new check' });
                }
              })
            } else {
              callback(400, { Error: 'User already has max number of checks (' + config.maxChecks + ')' });
            }
          } else {
            callback(403);
          }
        })
      } else {
        callback(403);
      }
    });
  } else {
    callback(400, { Error: 'Missing required inputs or inputs are invalid' });
  }
}

// Checks - get
// Required data: id
// Optional data: none
handlers._checks.get = function(data, callback) {
  // Check that phone is valid
  const id = (typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20) ? data.queryStringObject.id.trim() : false;
  if (id) {
    // Look up the check
    _data.read('checks', id, function(err, checkData) {
      if (!err && checkData) {
        // Get token from headers
        const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        // Verify that token from headers is valid and belongs to the user who created the check
        handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
          if (tokenIsValid) {
            // Return the checkData
            callback(200, checkData);
          } else {
            callback(403, { Error: 'Missing required token in header or token is invalid' });
          }
        });
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

// Checks - put
// Required data: id
// Optional data: protocol, url, successCodes, method, timeoutSeconds (one must be specified)
handlers._checks.put = function (data, callback) {
  // Check for required field
  const id = (typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20) ? data.payload.id.trim() : false;

  // Check for optional fields
  const protocol = (typeof(data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1) ? data.payload.protocol : false;
  const url = (typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0) ? data.payload.url.trim() : false;
  const method = (typeof(data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1) ? data.payload.method : false;
  const successCodes = (typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0) ? data.payload.successCodes : false;
  const timeoutSeconds = (typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5) ? data.payload.timeoutSeconds : false;

  // Error if id is invalid
  if (id) {
    // Make sure one or more optional fields are included
    if (protocol || method || successCodes || url || timeoutSeconds) {
      _data.read('checks', id, function(err, checkData) {
        if (!err && checkData) {
          // Get token from headers
          const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

          // Verify that token from headers is valid and belongs to the user who created the check
          handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
            if (tokenIsValid) {
              // Update the check data
              if (protocol) {
                checkData.protocol = protocol;
              }
              if (url) {
                checkData.url = url;
              }
              if (method) {
                checkData.method = method;
              }
              if (successCodes) {
                checkData.successCodes = successCodes;
              }
              if (timeoutSeconds) {
                checkData.timeoutSeconds = timeoutSeconds;
              }

              // Store updates
              _data.update('checks', id, checkData, function(err) {
                if (!err) {
                  callback(200);
                } else {
                  callback(500, { Error: 'Could not update check' });
                }
              })
            } else {
              callback(403, { Error: 'Missing required token in header or token is invalid' });
            }
          });
        } else {
          callback(400, { Error: 'Check ID did not exist' });
        }
      })
    } else {
      callback(400, { Error: 'Missing fields to update' });
    }
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

// Checks - delete
// Required data: id
// Optional data: none
handlers._checks.delete = function(data, callback) {
  // Check that phone is valid
  const id = (typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20) ? data.queryStringObject.id.trim() : false;

  if (id) {
    // Look up the check
    _data.read('checks', id, function(err, checkData) {
      if (!err && checkData) {
        // Get token from headers
        const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        // Verify that token from headers is valid for phone
        handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
          if (tokenIsValid) {
            _data.delete('checks', id, function(err) {
              if (!err) {
                _data.read('users', checkData.userPhone, function(err, userData) {
                  if (!err && userData) {
                    const userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

                    // Remove the deleted check from the list
                    const checkPosition = userChecks.indexOf(id);

                    if (checkPosition > -1) {
                      userChecks.splice(checkPosition, 1);

                      // Re-save the user's data
                      _data.update('users', checkData.userPhone, userData, function(err) {
                        if (!err) {
                          callback(200);
                        } else {
                          callback(500, { Error: 'Could not update the specified user' });
                        }
                      });

                    } else {
                      callback(500, { Error: 'Could not find the check on the user\'s object, so could not remove it' });
                    }
                } else {
                    callback(500, { Error: 'Could not find the user who created the specified check' });
                  }
                });

              } else {
                callback(500, { Error: 'Could not delete the check data' });
              }
            });
          } else {
            callback(403);
          }
        });
      } else {
        callback(400, { Error: 'The specified check ID does not exist' });
      }
    });
  } else {
    callback(400, { Error: 'Missing required field' });
  }
};

// Export the module
module.exports = handlers;
