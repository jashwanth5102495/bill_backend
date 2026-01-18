# Billboard Backend API

Complete backend API server for the Billboard Booking App with MongoDB integration and Razorpay payment gateway.

## Features

- 🔐 **Authentication**: Mobile OTP-based login with JWT tokens
- 👤 **User Management**: User profiles and business profiles
- 📅 **Booking System**: Complete booking management with status tracking
- 💳 **Payment Integration**: Razorpay payment gateway with refunds
- ❤️ **Favorites**: User favorites management
- 🛡️ **Security**: Rate limiting, input validation, and secure headers
- 📊 **Analytics**: User statistics and booking history

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (running locally or cloud instance)
- npm or yarn

### Installation

1. **Clone and setup**
   ```bash
   cd backend
   chmod +x install.sh
   ./install.sh
   ```

2. **Configure environment**
   ```bash
   # Update .env file with your values
   nano .env
   ```

3. **Start the server**
   ```bash
   npm run dev
   ```

4. **Verify installation**
   ```bash
   curl http://localhost:3000/api/health
   ```

## Environment Configuration

Update `.env` file with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/billboard-app

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_NyLZPzYHIYtxqW
RAZORPAY_KEY_SECRET=OixhI108NMwzhJIAkNrHx5jx

# Development Settings
SKIP_OTP_IN_DEV=true
DEV_OTP=123456

# CORS Settings
ALLOWED_ORIGINS=http://localhost:8081,exp://192.168.1.100:8081
```

## API Endpoints

### Authentication
- `POST /api/auth/send-otp` - Send OTP to phone number
- `POST /api/auth/verify-otp` - Verify OTP and login
- `POST /api/auth/skip-otp` - Skip OTP (development only)
- `POST /api/auth/refresh-token` - Refresh JWT token

### Users
- `GET /api/users/:userId` - Get user profile
- `PUT /api/users/:userId` - Update user profile
- `DELETE /api/users/:userId` - Delete user account
- `GET /api/users/:userId/stats` - Get user statistics

### Business Profiles
- `POST /api/business-profiles` - Create business profile
- `GET /api/business-profiles/user/:userId` - Get business profile
- `PUT /api/business-profiles/user/:userId` - Update business profile
- `DELETE /api/business-profiles/user/:userId` - Delete business profile

### Bookings
- `POST /api/bookings` - Create new booking
- `GET /api/bookings/user/:userId` - Get user bookings
- `GET /api/bookings/:bookingId` - Get specific booking
- `PUT /api/bookings/:bookingId` - Update booking
- `POST /api/bookings/:bookingId/cancel` - Cancel booking
- `GET /api/bookings/user/:userId/history` - Get booking history

### Favorites
- `POST /api/favorites` - Add to favorites
- `GET /api/favorites/user/:userId` - Get user favorites
- `DELETE /api/favorites/user/:userId/item/:itemId` - Remove from favorites
- `GET /api/favorites/user/:userId/check/:itemId` - Check if favorited

### Payments
- `POST /api/payments/create-order` - Create Razorpay order
- `POST /api/payments/verify-payment` - Verify payment
- `GET /api/payments/payment/:paymentId` - Get payment details
- `POST /api/payments/refund` - Process refund
- `POST /api/payments/webhook` - Razorpay webhook

### Health Check
- `GET /api/health` - Server health status

## Development Features

### Skip OTP in Development

For development convenience, you can skip OTP verification:

```bash
# Set in .env
SKIP_OTP_IN_DEV=true
DEV_OTP=123456
```

Then use the skip endpoint:
```bash
curl -X POST http://localhost:3000/api/auth/skip-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919876543210"}'
```

### Database Collections

The API automatically creates these MongoDB collections:

- **users** - User accounts and profiles
- **businessprofiles** - Business information
- **bookings** - Booking records with payment status
- **favorites** - User favorites
- **otpverifications** - OTP verification records (auto-expires)

### Sample API Calls

1. **Skip OTP Login (Development)**
   ```bash
   curl -X POST http://localhost:3000/api/auth/skip-otp \
     -H "Content-Type: application/json" \
     -d '{"phoneNumber": "+919876543210"}'
   ```

2. **Create Business Profile**
   ```bash
   curl -X POST http://localhost:3000/api/business-profiles \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{
       "businessName": "My Business",
       "businessType": "Retail Store",
       "ownerName": "John Doe",
       "email": "john@business.com",
       "address": "123 Business St",
       "city": "Bangalore",
       "state": "Karnataka",
       "pincode": "560001"
     }'
   ```

3. **Create Booking**
   ```bash
   curl -X POST http://localhost:3000/api/bookings \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{
       "bookingType": "personal-wishes",
       "billboardId": "billboard_123",
       "billboardName": "Main Street Billboard",
       "location": "Bangalore, Karnataka",
       "startDate": "2025-08-01",
       "endDate": "2025-08-01",
       "startTime": "10:00",
       "endTime": "18:00",
       "duration": 8,
       "price": 2500,
       "content": {
         "type": "text",
         "text": "Happy Birthday!"
       }
     }'
   ```

## Security Features

- **Rate Limiting**: API calls limited per IP
- **OTP Rate Limiting**: Stricter limits for OTP requests
- **JWT Authentication**: Secure token-based auth
- **Input Validation**: All inputs validated and sanitized
- **CORS Protection**: Configurable allowed origins
- **Helmet Security**: Security headers enabled

## Payment Integration

### Razorpay Setup

1. **Get API Keys**
   - Login to Razorpay Dashboard
   - Get Key ID and Key Secret
   - Update in `.env` file

2. **Test Payment Flow**
   ```bash
   # 1. Create order
   curl -X POST http://localhost:3000/api/payments/create-order \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"amount": 2500, "bookingId": "BOOKING_ID"}'
   
   # 2. Verify payment (after payment on frontend)
   curl -X POST http://localhost:3000/api/payments/verify-payment \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{
       "razorpay_order_id": "order_xxx",
       "razorpay_payment_id": "pay_xxx",
       "razorpay_signature": "signature_xxx",
       "bookingId": "BOOKING_ID"
     }'
   ```

## Monitoring and Logs

- **Console Logs**: Detailed logging for development
- **Error Handling**: Comprehensive error responses
- **Health Check**: Monitor server and database status

## Production Deployment

1. **Environment Setup**
   ```bash
   NODE_ENV=production
   SKIP_OTP_IN_DEV=false
   # Add production MongoDB URI
   # Add production Razorpay keys
   ```

2. **Security Checklist**
   - [ ] Change JWT secret
   - [ ] Use production MongoDB
   - [ ] Configure proper CORS origins
   - [ ] Set up SSL/HTTPS
   - [ ] Configure webhook secrets
   - [ ] Set up monitoring

3. **Deploy Options**
   - **Heroku**: Easy deployment with MongoDB Atlas
   - **AWS**: EC2 + RDS/DocumentDB
   - **DigitalOcean**: Droplets + Managed MongoDB
   - **Google Cloud**: App Engine + Firestore

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   ```bash
   # Check if MongoDB is running
   sudo systemctl status mongod
   # Or for macOS
   brew services list | grep mongodb
   ```

2. **Port Already in Use**
   ```bash
   # Kill process on port 3000
   lsof -ti:3000 | xargs kill -9
   ```

3. **JWT Token Issues**
   - Check token expiration
   - Verify JWT_SECRET in .env
   - Ensure proper Authorization header format

4. **Razorpay Errors**
   - Verify API keys in .env
   - Check webhook URL configuration
   - Validate signature verification

### Debug Mode

Enable detailed logging:
```bash
DEBUG=* npm run dev
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Submit pull request

## License

MIT License - see LICENSE file for details.

---

**🚀 Your Billboard Backend API is ready!**

Start the server with `npm run dev` and begin building your billboard booking application.