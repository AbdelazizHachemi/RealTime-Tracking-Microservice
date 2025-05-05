const Driver = require('../models/Driver');

// Sidi Bel Abbès center coordinates
const CENTER_LAT = 35.1992;
const CENTER_LNG = -0.6306;

// Function to generate random movement within a radius
function getRandomOffset(radius) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    return {
        lat: distance * Math.sin(angle) / 111000, // 1 degree ≈ 111km
        lng: distance * Math.cos(angle) / (111000 * Math.cos(CENTER_LAT * Math.PI / 180))
    };
}

// Function to update driver locations
async function updateDriverLocations(io) {
    try {
        const drivers = await Driver.find();
        
        for (const driver of drivers) {
            if (driver.status !== 'offline') {
                // Get current location
                const currentLat = driver.location.coordinates[1];
                const currentLng = driver.location.coordinates[0];
                
                // Generate new location within 500 meters
                const offset = getRandomOffset(500);
                const newLat = currentLat + offset.lat;
                const newLng = currentLng + offset.lng;
                
                // Update driver location
                driver.location = {
                    type: 'Point',
                    coordinates: [newLng, newLat]
                };
                driver.lastUpdated = new Date();
                
                await driver.save();
                
                // Emit location update
                io.emit('driverLocationUpdate', {
                    driverId: driver._id,
                    name: driver.name,
                    status: driver.status,
                    location: driver.location
                });
            }
        }
    } catch (error) {
        console.error('Error updating driver locations:', error);
    }
}

// Function to simulate driver status changes
async function simulateStatusChanges(io) {
    try {
        const drivers = await Driver.find();
        
        for (const driver of drivers) {
            if (Math.random() < 0.1) { // 10% chance to change status
                const statuses = ['available', 'busy', 'offline'];
                const currentIndex = statuses.indexOf(driver.status);
                const newIndex = (currentIndex + 1) % statuses.length;
                driver.status = statuses[newIndex];
                
                await driver.save();
                
                // Emit status update
                io.emit('driverLocationUpdate', {
                    driverId: driver._id,
                    name: driver.name,
                    status: driver.status,
                    location: driver.location
                });
            }
        }
    } catch (error) {
        console.error('Error simulating status changes:', error);
    }
}

module.exports = {
    startSimulation: (io) => {
        // Update locations every 5 seconds
        setInterval(() => updateDriverLocations(io), 5000);
        
        // Simulate status changes every 30 seconds
        setInterval(() => simulateStatusChanges(io), 30000);
    }
}; 