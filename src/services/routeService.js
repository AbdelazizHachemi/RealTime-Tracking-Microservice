const OpenRouteService = require('openrouteservice-js');

class RouteService {
    constructor(apiKey) {
        this.ors = new OpenRouteService.Directions({
            api_key: apiKey
        });
    }

    async getOptimizedRoute(start, waypoints, end) {
        try {
            // Ensure coordinates are in [longitude, latitude] format
            // OpenRouteService requires coordinates in [lon, lat] order
            const coordinates = [
                start, // Start point is already in [lon, lat] format
                ...waypoints, // Waypoints are already in [lon, lat] format
                end // End point is already in [lon, lat] format
            ];

            console.log('Sending coordinates to OpenRouteService:', coordinates);

            // Get optimized route
            const response = await this.ors.calculate({
                coordinates: coordinates,
                profile: 'driving-car',
                format: 'geojson'
            });

            return response;
        } catch (error) {
            console.error('Error getting optimized route:', error);
            if (error.response) {
                const responseText = await error.response.text();
                console.error('API Response:', responseText);
            }
            throw error;
        }
    }

    async getRouteDistanceAndDuration(start, end) {
        try {
            // Ensure coordinates are in [longitude, latitude] format
            const coordinates = [
                start, // Start point is already in [lon, lat] format
                end // End point is already in [lon, lat] format
            ];

            console.log('Sending coordinates to OpenRouteService:', coordinates);

            const response = await this.ors.calculate({
                coordinates: coordinates,
                profile: 'driving-car',
                format: 'geojson'
            });

            // Extract distance in meters and duration in seconds
            const distance = response.features[0].properties.segments[0].distance;
            const duration = response.features[0].properties.segments[0].duration;

            return {
                distance: distance / 1000, // Convert to kilometers
                duration: Math.round(duration / 60) // Convert to minutes
            };
        } catch (error) {
            console.error('Error getting route distance and duration:', error);
            if (error.response) {
                const responseText = await error.response.text();
                console.error('API Response:', responseText);
            }
            throw error;
        }
    }
}

module.exports = RouteService; 