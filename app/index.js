/*
 * Primary file for API
 */

// Dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');

const app = {};

// Init function
app.init = function() {
  // Start the server
  server.init();

  // Start the workers
  workers.init();
};

app.init();

module.exports = app;
