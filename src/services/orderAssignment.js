const Driver = require('../models/Driver');
const Order = require('../models/Order');

class OrderAssignmentService {
    constructor(io) {
        this.io = io;
    }

    // Assign order to nearest available driver
    async assignOrder(orderId) {
        const order = await Order.findById(orderId).populate('restaurant').populate('customer');
        if (!order) throw new Error('Order not found');
        if (order.status !== 'pending') throw new Error('Order already assigned');

        // Find nearest available driver
        const driver = await Driver.findOne({
            status: 'available',
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: order.restaurant.location.coordinates
                    },
                    $maxDistance: 10000 // 10km radius - increased to ensure we find drivers
                }
            }
        });

        if (!driver) throw new Error('No available drivers nearby');

        // Update order and driver status
        order.driver = driver._id;
        order.status = 'assigned';
        
        // Calculate pickup time based on distance
        const distanceToRestaurant = this.calculateDistance(
            { latitude: driver.location.coordinates[1], longitude: driver.location.coordinates[0] },
            order.restaurant.location.coordinates
        );
        const pickupETA = this.calculateETA(distanceToRestaurant);
        order.estimatedPickupTime = new Date(Date.now() + pickupETA * 60000); // ETA in minutes
        
        await order.save();

        driver.status = 'busy';
        await driver.save();

        // Update the order in the UI
        const updatedOrder = await Order.findById(orderId)
            .populate('driver')
            .populate('restaurant')
            .populate('customer');
            
        this.io.emit('orderStatusUpdate', updatedOrder);

        // Emit updates
        this.io.emit('orderAssigned', {
            orderId: order._id,
            driverId: driver._id,
            driverName: driver.name,
            estimatedPickupTime: order.estimatedPickupTime,
            restaurantName: order.restaurant.name,
            customerName: order.customer.name
        });
        
        // Also emit a driver location update to ensure the UI is updated properly
        this.io.emit('driverLocationUpdate', {
            driverId: driver._id,
            name: driver.name,
            status: driver.status,
            location: driver.location,
            orderId: order._id,
            estimatedTime: pickupETA,
            destination: 'restaurant',
            destinationName: order.restaurant.name
        });

        return { order, driver };
    }

    // Update order status and driver location
    async updateOrderStatus(orderId, status) {
        const order = await Order.findById(orderId)
            .populate('driver')
            .populate('restaurant')
            .populate('customer');
            
        if (!order) throw new Error('Order not found');

        const previousStatus = order.status;
        order.status = status;

        switch (status) {
            case 'picked_up':
                order.actualPickupTime = new Date();
                
                // Calculate delivery time based on distance to customer
                const distanceToCustomer = this.calculateDistance(
                    order.restaurant.location.coordinates,
                    order.customer.location.coordinates
                );
                const deliveryETA = this.calculateETA(distanceToCustomer);
                order.estimatedDeliveryTime = new Date(Date.now() + deliveryETA * 60000); // ETA in minutes
                break;
                
            case 'in_transit':
                // Order is in transit, update estimated delivery time if needed
                if (order.driver && order.driver.location) {
                    const distanceToCustomer = this.calculateDistance(
                        { 
                            latitude: order.driver.location.coordinates[1], 
                            longitude: order.driver.location.coordinates[0] 
                        },
                        order.customer.location.coordinates
                    );
                    const deliveryETA = this.calculateETA(distanceToCustomer);
                    order.estimatedDeliveryTime = new Date(Date.now() + deliveryETA * 60000);
                }
                break;
                
            case 'delivered':
                order.actualDeliveryTime = new Date();
                // Make driver available again
                if (order.driver) {
                    order.driver.status = 'available';
                    await order.driver.save();
                    
                    // Also emit a driver location update to refresh the UI
                    this.io.emit('driverLocationUpdate', {
                        driverId: order.driver._id,
                        name: order.driver.name,
                        status: 'available',
                        location: order.driver.location
                    });
                }
                break;
        }

        await order.save();

        // Get the updated order with populated references
        const updatedOrder = await Order.findById(orderId)
            .populate('driver')
            .populate('restaurant')
            .populate('customer');

        // Emit full order object for better UI updates
        this.io.emit('orderStatusUpdate', updatedOrder);

        return updatedOrder;
    }

    // Update driver location during delivery
    async updateDriverLocation(driverId, location) {
        const driver = await Driver.findById(driverId);
        if (!driver) throw new Error('Driver not found');

        driver.location = {
            type: 'Point',
            coordinates: [location.longitude, location.latitude]
        };
        driver.lastUpdated = new Date();
        await driver.save();

        // Find active order for this driver
        const activeOrder = await Order.findOne({
            driver: driverId,
            status: { $in: ['assigned', 'picked_up', 'in_transit'] }
        }).populate('restaurant').populate('customer');

        if (activeOrder) {
            // If assigned, simulate movement toward the restaurant
            if (activeOrder.status === 'assigned') {
                const targetLocation = activeOrder.restaurant.location.coordinates;
                const distanceToRestaurant = this.calculateDistance(
                    location,
                    targetLocation
                );
                
                const estimatedTime = this.calculateETA(distanceToRestaurant);
                
                // Emit location update with ETA
                this.io.emit('driverLocationUpdate', {
                    driverId: driver._id,
                    name: driver.name,
                    status: driver.status,
                    location: driver.location,
                    orderId: activeOrder._id,
                    estimatedTime: estimatedTime,
                    destination: 'restaurant',
                    destinationName: activeOrder.restaurant.name
                });
                
                // If driver is very close to restaurant, automatically update status to picked_up
                if (distanceToRestaurant < 50) { // Within 50 meters
                    setTimeout(() => {
                        this.updateOrderStatus(activeOrder._id, 'picked_up');
                    }, 5000); // Wait 5 seconds before updating status
                }
            } 
            // If picked up, simulate movement toward the customer
            else if (activeOrder.status === 'picked_up' || activeOrder.status === 'in_transit') {
                const targetLocation = activeOrder.customer.location.coordinates;
                const distanceToCustomer = this.calculateDistance(
                    location,
                    targetLocation
                );
                
                const estimatedTime = this.calculateETA(distanceToCustomer);
                
                // Emit location update with ETA
                this.io.emit('driverLocationUpdate', {
                    driverId: driver._id,
                    name: driver.name,
                    status: driver.status,
                    location: driver.location,
                    orderId: activeOrder._id,
                    estimatedTime: estimatedTime,
                    destination: 'customer',
                    destinationName: activeOrder.customer.name
                });
                
                // If driver is very close to customer, automatically update status to delivered
                if (distanceToCustomer < 50) { // Within 50 meters
                    setTimeout(() => {
                        this.updateOrderStatus(activeOrder._id, 'delivered');
                    }, 5000); // Wait 5 seconds before updating status
                }
                
                // If status is picked_up, automatically transition to in_transit after a short delay
                if (activeOrder.status === 'picked_up') {
                    setTimeout(() => {
                        this.updateOrderStatus(activeOrder._id, 'in_transit');
                    }, 10000); // Wait 10 seconds before transitioning to in_transit
                }
            }
        } else {
            // Emit regular location update
            this.io.emit('driverLocationUpdate', {
                driverId: driver._id,
                name: driver.name,
                status: driver.status,
                location: driver.location
            });
        }

        return driver;
    }

    // Helper function to calculate distance between two points
    calculateDistance(point1, point2) {
        const R = 6371e3; // Earth's radius in meters
        
        // Standardize the input format
        const lat1 = typeof point1.latitude !== 'undefined' ? point1.latitude : point1[1];
        const lon1 = typeof point1.longitude !== 'undefined' ? point1.longitude : point1[0];
        const lat2 = typeof point2.latitude !== 'undefined' ? point2.latitude : point2[1];
        const lon2 = typeof point2.longitude !== 'undefined' ? point2.longitude : point2[0];
        
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2 - lat1) * Math.PI/180;
        const Δλ = (lon2 - lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    // Helper function to calculate ETA based on distance
    calculateETA(distance) {
        // Average speed varies based on distance
        // For shorter distances (< 1km), slower speed (20 km/h) to account for traffic/navigation
        // For medium distances (1-5km), medium speed (30 km/h)
        // For longer distances (>5km), faster speed (40 km/h) to account for highway travel
        
        let averageSpeed; // in meters per second
        
        if (distance < 1000) {
            averageSpeed = 20 * 1000 / 3600; // 20 km/h in m/s
        } else if (distance < 5000) {
            averageSpeed = 30 * 1000 / 3600; // 30 km/h in m/s
        } else {
            averageSpeed = 40 * 1000 / 3600; // 40 km/h in m/s
        }
        
        // Add a random factor to make ETAs more realistic (±10%)
        const randomFactor = 0.9 + (Math.random() * 0.2); // Between 0.9 and 1.1
        
        // Calculate minutes, with a minimum of 1 minute
        const minutes = Math.ceil((distance / averageSpeed / 60) * randomFactor); 
        return Math.max(1, minutes);
    }
}

module.exports = OrderAssignmentService;