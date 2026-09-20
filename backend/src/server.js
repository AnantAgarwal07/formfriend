/**
 * Local development entry point.
 * Starts the Express app on the configured port.
 *
 * Usage:  node src/server.js
 */

const app = require('./app');
const config = require('./config/env');

app.listen(config.port, () => {
  console.log(`\n🚀  FormFriend backend running at http://localhost:${config.port}`);
  console.log(`   Environment : ${config.nodeEnv}`);
  console.log(`   AWS Region  : ${config.awsRegion}`);
  console.log(`   DynamoDB    : ${config.dynamoTableName}`);
  console.log(`   Redis TTL   : ${config.redisTtlSeconds}s\n`);
});
