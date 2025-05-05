const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Driver = require('../models/Driver');
const { body, validationResult } = require('express-validator');
const RouteService = require('../services/routeService');

// Initialize RouteService with your OpenRouteService API key
const routeService = new RouteService(process.env.OPENROUTESERVICE_API_KEY);

// Reset all driver statuses to available
async function resetDriverStatuses() {
    await Driver.updateMany(
        { status: 'busy' },
        { $set: { status: 'available' } }
    );
}

// Calculate distance between two points in kilometers
function calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(point2[1] - point1[1]);
    const dLon = toRad(point2[0] - point1[0]);
    const lat1 = toRad(point1[1]);
    const lat2 = toRad(point2[1]);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(degrees) {
    return degrees * Math.PI / 180;
}

// Calculate ETA in minutes
function calculateETA(distance) {
    const averageSpeed = 30; // km/h
    return Math.round((distance / averageSpeed) * 60);
}

// Create a new order
router.post('/', [
    body('restaurant.name').notEmpty(),
    body('restaurant.location.coordinates').isArray().isLength(2),
    body('customer.name').notEmpty(),
    body('customer.location.coordinates').isArray().isLength(2),
    body('driver').optional().isMongoId(),
    body('status').optional().isIn(['pending', 'assigned', 'picked_up', 'in_transit', 'delivered'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        console.log('Creating new order...');
        console.log('Restaurant location:', req.body.restaurant.location.coordinates);
        console.log('Customer location:', req.body.customer.location.coordinates);

        // If no driver is specified, find the nearest available driver
        let driverId = req.body.driver;
        let nearestDriver = null;
        if (!driverId) {
            const restaurantLocation = req.body.restaurant.location.coordinates;
            console.log('Finding nearest driver to restaurant at:', restaurantLocation);
            
            // Find all available drivers
            const availableDrivers = await Driver.find({ status: 'available' });
            console.log('Available drivers:', availableDrivers.map(d => ({ name: d.name, location: d.location.coordinates })));

            // Find the nearest available driver to the restaurant
            nearestDriver = await Driver.findOne({
                status: 'available',
                location: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: restaurantLocation
                        }
                    }
                }
            });

            if (!nearestDriver) {
                console.log('No available drivers found');
                return res.status(400).json({ message: 'No available drivers' });
            }
            driverId = nearestDriver._id;
            console.log(`Found nearest driver: ${nearestDriver.name} at ${nearestDriver.location.coordinates}`);
        } else {
            nearestDriver = await Driver.findById(driverId);
            console.log(`Using specified driver: ${nearestDriver.name} at ${nearestDriver.location.coordinates}`);
        }

        // Calculate distances and ETA using OpenRouteService
        console.log('Driver coordinates:', nearestDriver.location.coordinates);
        console.log('Restaurant coordinates:', req.body.restaurant.location.coordinates);
        console.log('Customer coordinates:', req.body.customer.location.coordinates);

        const driverToRestaurant = await routeService.getRouteDistanceAndDuration(
            nearestDriver.location.coordinates,
            req.body.restaurant.location.coordinates
        );

        const restaurantToCustomer = await routeService.getRouteDistanceAndDuration(
            req.body.restaurant.location.coordinates,
            req.body.customer.location.coordinates
        );

        const totalDistance = driverToRestaurant.distance + restaurantToCustomer.distance;
        const estimatedTime = driverToRestaurant.duration + restaurantToCustomer.duration;

        // Create the order with the calculated values
        const order = new Order({
            orderId: `ORD-${Date.now()}`,
            restaurant: req.body.restaurant,
            customer: req.body.customer,
            driver: driverId,
            status: 'assigned',
            estimatedDeliveryTime: new Date(Date.now() + estimatedTime * 60000), // Convert minutes to milliseconds
            distance: totalDistance,
            estimatedTime: estimatedTime
        });

        await order.save();

        // Update driver status
        nearestDriver.status = 'busy';
        await nearestDriver.save();

        // Get the optimized route for the driver
        const optimizedRoute = await routeService.getOptimizedRoute(
            nearestDriver.location.coordinates,
            [req.body.restaurant.location.coordinates],
            req.body.customer.location.coordinates
        );

        // Emit order assignment with route information
        const io = req.app.get('io');
        io.emit('orderAssigned', {
            orderId: order._id,
            driverId: driverId,
            route: optimizedRoute,
            estimatedTime: estimatedTime
        });

        res.status(201).json(order);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get all orders
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find().populate('driver');
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get order by ID
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('driver');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update order status
router.put('/:id/status', [
    body('status').isIn(['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const order = await Order.findById(req.params.id).populate('driver');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const oldStatus = order.status;
        order.status = req.body.status;
        await order.save();

        // Update driver status based on order status
        if (order.driver) {
            let driverStatus = 'available';
            if (['assigned', 'picked_up', 'in_transit'].includes(order.status)) {
                driverStatus = 'busy';
            }
            await Driver.findByIdAndUpdate(order.driver._id, { status: driverStatus });
        }

        res.json(order);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete order
router.delete('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('driver');
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Reset driver status before deleting order
        if (order.driver) {
            await Driver.findByIdAndUpdate(order.driver._id, { status: 'available' });
        }

        await order.deleteOne();
        res.json({ message: 'Order deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Reset all driver statuses
router.post('/reset-drivers', async (req, res) => {
    try {
        await resetDriverStatuses();
        res.json({ message: 'All driver statuses reset to available' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router; 