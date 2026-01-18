const mongoose = require('mongoose');
const ConnectRequest = require('./src/models/ConnectRequest');
console.log('Starting DB check...');

const uri = 'mongodb://127.0.0.1:27017/billboard-app'; 

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to MongoDB');
    const requests = await ConnectRequest.find();
    console.log('Requests count:', requests.length);
    console.log('Requests:', JSON.stringify(requests, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
  });
