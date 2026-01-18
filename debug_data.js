const mongoose = require('mongoose');
const Billboard = require('./src/models/Billboard');
const Booking = require('./src/models/Booking');
const User = require('./src/models/User');
require('dotenv').config();

const checkData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/billboard-app');
    console.log('Connected to MongoDB');

    console.log('\n--- USERS (Billboard Owners) ---');
    const owners = await User.find({ role: 'billboard_owner' });
    owners.forEach(u => console.log(`ID: ${u._id}, Name: ${u.username}, Email: ${u.email}`));

    console.log('\n--- BILLBOARDS ---');
    const billboards = await Billboard.find({});
    billboards.forEach(b => console.log(`ID: ${b._id}, Name: ${b.name}, OwnerId: ${b.ownerId}`));

    console.log('\n--- BOOKINGS ---');
    const bookings = await Booking.find({});
    bookings.forEach(b => console.log(`ID: ${b._id}, BillboardId: ${b.billboardId}, UserId: ${b.userId}, Status: ${b.status}`));

    if (bookings.length > 0 && billboards.length > 0) {
        console.log('\n--- MATCHING CHECK ---');
        const booking = bookings[0];
        const billboard = billboards.find(b => b._id.toString() === booking.billboardId.toString());
        if (billboard) {
            console.log(`Booking ${booking._id} is for Billboard ${billboard.name} (ID: ${billboard._id})`);
            console.log(`Billboard Owner is: ${billboard.ownerId}`);
        } else {
            console.log(`Booking ${booking._id} has orphan BillboardId: ${booking.billboardId}`);
        }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

checkData();
