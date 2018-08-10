/*
* Create and export configuration variables
*/

// Container for all the environments
const environments = {};

// Staging object (default)
environments.staging = {
  httpPort: 3000,
  httpsPort: 3001,
  envName: 'staging',
  hashingSecret: 'thisIsASecret',
  maxChecks: 5,
  pingInterval: 5,
  twilio: {
    accountSid: process.env.TWILIO_ACCT_ID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromPhone: '+1' + process.env.TWILIO_FROM_PHONE
  },
  templateGlobals: {
    appName: 'Uptime Checker',
    companyName: 'Not A Real Company, Inc',
    yearCreated: '2018',
    baseUrl: 'http://localhost:3000/'
  }
};

// Production object
environments.production = {
  httpPort: 5000,
  httpsPort: 5001,
  envName: 'production',
  hashingSecret: 'thisIsAlsoASecret',
  maxChecks: 5,
  pingInterval: 5,
  twilio: {
    accountSid: process.env.TWILIO_ACCT_ID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromPhone: '+1' + process.env.TWILIO_FROM_PHONE
  },
  templateGlobals: {
    appName: 'Uptime Checker',
    companyName: 'Not A Real Company, Inc',
    yearCreated: '2018',
    baseUrl: 'http://localhost:5000/'
  }
};

// Determine which should be exported
const currentEnvironment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : 'staging';

// Check that currentEnvironment is one of the defined environments, otherwise default to staging
const environmentToExport = typeof(environments[currentEnvironment]) == 'object' ? environments[currentEnvironment] : 'staging';

// Export the module
module.exports = environmentToExport;
