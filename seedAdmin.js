const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('Connected to MongoDB');
  
  const adminExists = await User.findOne({ role: 'admin' });
  if (adminExists) {
    console.log('Admin already exists');
    process.exit(0);
  }

  const admin = new User({
    username: 'admin',
    password: 'adminpassword123',
    role: 'admin',
    name: 'Super Admin',
    isActive: true
  });

  await admin.save();
  console.log('Admin user created successfully');
  console.log('Username: admin');
  console.log('Password: adminpassword123');
  process.exit(0);
})
.catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
