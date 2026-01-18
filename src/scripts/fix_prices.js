const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Billboard = require('../models/Billboard');
require('dotenv').config({ path: '../../.env' }); // Adjusted path assuming script is in src/scripts/ and .env is in backend/

// If that path doesn't work, try default (current working directory)
if (!process.env.MONGODB_URI) {
    require('dotenv').config();
}

const SLOT_DURATION_SECONDS = 21600; // 6 hours

const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, '../../fix_price_debug.log');

function log(msg) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

async function fixPrices() {
  try {
    fs.writeFileSync(logFile, 'Starting price fix script...\n');
    log('Starting price fix script...');
    
    if (!process.env.MONGODB_URI) {
        log('MONGODB_URI not found in env. Please ensure .env file exists in backend root.');
        process.exit(1);
    }
    log('URI found (masked): ' + process.env.MONGODB_URI.substring(0, 15) + '...');

    await mongoose.connect(process.env.MONGODB_URI);
    log('Connected to MongoDB');
    log('Database name: ' + mongoose.connection.name);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    log('Collections: ' + collections.map(c => c.name).join(', '));

    // List all bookings to debug
    const allBookings = await Booking.find({}).sort({ createdAt: -1 }).limit(10);
    log(`Total bookings found: ${allBookings.length}`);
    allBookings.forEach(b => {
        log(`- ID: ${b._id}, Price: ${b.price}, Type: ${typeof b.price}`);
    });

    // Find bookings with price > 100,000 (Safety threshold)
    const bookings = await Booking.find({ price: { $gt: 100000 } });
    log(`Found ${bookings.length} bookings with suspicious high price (> 100,000)`);

    for (const booking of bookings) {
        try {
            const billboard = await Billboard.findById(booking.billboardId);
            if (!billboard) {
                log(`Skipping booking ${booking._id}: Billboard ${booking.billboardId} not found`);
                continue;
            }

            // Determine slot price based on start time
            let slotPrice = 0;
            // Parse HH:MM
            const hour = parseInt(booking.startTime.split(':')[0]);
            
            // Map time to slot
            let slotName = 'unknown';
            if (hour >= 6 && hour < 12) {
                slotPrice = billboard.slotPricing?.morning;
                slotName = 'morning';
            } else if (hour >= 12 && hour < 18) {
                slotPrice = billboard.slotPricing?.afternoon;
                slotName = 'afternoon';
            } else if (hour >= 18) {
                slotPrice = billboard.slotPricing?.evening;
                slotName = 'evening';
            } else {
                slotPrice = billboard.slotPricing?.night;
                slotName = 'night';
            }

            // Fallback
            if (!slotPrice) {
                 slotPrice = billboard.price || 12000; 
                 log(`Slot price missing for ${slotName}, using fallback: ${slotPrice}`);
            }

            // Calculate days
            const start = new Date(booking.startDate);
            const end = new Date(booking.endDate);
            start.setHours(0,0,0,0);
            end.setHours(0,0,0,0);
            const oneDay = 24 * 60 * 60 * 1000;
            const diffDays = Math.round(Math.abs((end - start) / oneDay)) + 1;
            
            // Get duration and reputation
            const videoDuration = booking.videoDuration || 15; 
            const reputation = booking.reputation || 40;
            
            // Calculate correct price
            const costPerSecond = slotPrice / SLOT_DURATION_SECONDS;
            const dailyConsumedSeconds = videoDuration * reputation;
            const correctPrice = Math.round(costPerSecond * dailyConsumedSeconds * diffDays);

            log(`Fixing Booking ${booking._id}:`);
            log(`- Old Price: ${booking.price}`);
            log(`- Params: SlotPrice=${slotPrice} (${slotName}), VidDur=${videoDuration}, Rep=${reputation}, Days=${diffDays}`);
            log(`- New Price: ${correctPrice}`);

            // Update
            booking.price = correctPrice;
            await booking.save();
            log(`- Booking updated successfully.\n`);
            
        } catch (err) {
            log(`Error processing booking ${booking._id}: ${err.message}`);
        }
    }

    log('Finished fixing prices');
    process.exit(0);
  } catch (error) {
    log(`Fatal Error: ${error.message}`);
    process.exit(1);
  }
}

fixPrices();
