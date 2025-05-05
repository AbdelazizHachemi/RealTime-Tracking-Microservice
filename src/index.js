require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const driverRoutes = require('./routes/driverRoutes');
const orderRoutes = require('./routes/orderRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const OrderAssignmentService = require('./services/orderAssignment');
const Driver = require('./models/Driver');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/drivers', driverRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/restaurants', restaurantRoutes);

// Initialize order assignment service
const orderAssignmentService = new OrderAssignmentService(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('updateLocation', async (data) => {
    try {
      await orderAssignmentService.updateDriverLocation(data.driverId, {
        latitude: data.location.coordinates[1],
        longitude: data.location.coordinates[0]
      });
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  });

  socket.on('assignOrder', async (data) => {
    try {
      await orderAssignmentService.assignOrder(data.orderId);
    } catch (error) {
      console.error('Error assigning order:', error);
    }
  });

  socket.on('updateOrderStatus', async (data) => {
    try {
      await orderAssignmentService.updateOrderStatus(data.orderId, data.status);
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Initialize test drivers
async function initializeTestDrivers() {
    const testDrivers = [
        {
            name: 'Driver 1',
            location: {
                type: 'Point',
                coordinates: [-0.6306, 35.1992] // Center of Sidi Bel Abbès
            },
            status: 'available'
        },
        {
            name: 'Driver 2',
            location: {
                type: 'Point',
                coordinates: [-0.6506, 35.1992] // West of center
            },
            status: 'available'
        },
        {
            name: 'Driver 3',
            location: {
                type: 'Point',
                coordinates: [-0.6226, 35.2092] // North of center
                  // [-0.6236, 35.2032]
            },
            status: 'available'
        }
    ];

    console.log('Initializing test drivers...');
    for (const driver of testDrivers) {
        const result = await Driver.findOneAndUpdate(
            { name: driver.name },
            driver,
            { upsert: true, new: true }
        );
        console.log(`Driver ${result.name} initialized at location:`, result.location.coordinates);
    }
    console.log('All test drivers initialized');
}

const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/delivery-tracking')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const Driver = require('./models/Driver');
    
    // Initialize test drivers
    await initializeTestDrivers();
    
    // Start the server
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));