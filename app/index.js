/*
 * Primary file for API
 */

// Dependencies
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');

// Instantiate the http server
const httpServer = http.createServer((req, res) => {
  unifiedServer(req, res);
});

// Start the http server
httpServer.listen(config.httpPort, () => {
  console.log('The server is listening on port ' + config.httpPort);
});

// Instantiate the https server
const httpsServerOptions = {
  key: fs.readFileSync('./https/key.pem'),
  cert: fs.readFileSync('./https/cert.pem')
};

const httpsServer = https.createServer(httpsServerOptions, (req, res) => {
  unifiedServer(req, res);
});

// Start the https server
httpsServer.listen(config.httpsPort, () => {
  console.log('The server is listening on port ' + config.httpsPort);
});

// All the server logic for http and https
const unifiedServer = function(req, res) {
  // Get URL and parse it
  const parsedUrl = url.parse(req.url, true);

  // Get path from URL
  const path = parsedUrl.pathname;
  const trimmedPath = path.replace(/^\/+|\/+$/g, '');

  // Get the query string
  const queryStringObject = parsedUrl.query;

  // Get the HTTP method
  const method = req.method.toLowerCase();

  // Get the headers as an object
  const headers = req.headers;

  // Get the payload
  const decoder = new StringDecoder('utf-8');
  let buffer = '';

  req.on('data', (data) => {
    buffer += decoder.write(data);
  });

  req.on('end', () => {
    buffer += decoder.end();

    const chosenHandler = typeof(router[trimmedPath]) !== 'undefined' ? router[trimmedPath] : handlers.notFound;

    const data = {
      trimmedPath,
      queryStringObject,
      method,
      headers,
      payload: buffer
    };

    chosenHandler(data, (statusCode, payload) => {
      statusCode = typeof(statusCode) === 'number' ? statusCode : 404;
      payload = typeof(payload) === 'object' ? payload : {};

      const payloadString = JSON.stringify(payload);

      // Send the response
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(statusCode);
      res.end(payloadString);

      // Log the path requested
      console.log('Returning this response: ', statusCode, payloadString);
    });
  });
};

// Define the handlers
const handlers = {
  notFound: (data, callback) => {
    callback(404);
  },
  ping: (data, callback) => {
    callback(200);
  }
};

const router = {
  ping: handlers.ping
};