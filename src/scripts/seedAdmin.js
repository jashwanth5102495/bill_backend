const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    // Using the same DB name as likely used in the app
    await mongoose.connect('mongodb://localhost:27017/billboard-db', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    const adminUsername = 'admin';
    const adminPassword = 'adminpassword123';

    // Check if admin exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.username);
      // Optional: Update password if needed, but for now just notify
    } else {
      // Create admin
      const admin = new User({
        username: adminUsername,
        password: adminPassword,
        role: 'admin',
        name: 'Super Admin',
        email: 'admin@example.com',
        phoneNumber: '+1234567890'
      });

      await admin.save();
      console.log('Admin user created successfully');
      console.log('Username:', adminUsername);
      console.log('Password:', adminPassword);
    }

  } catch (error) {
    console.error('Error seeding admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit();
  }
};

seedAdmin();
