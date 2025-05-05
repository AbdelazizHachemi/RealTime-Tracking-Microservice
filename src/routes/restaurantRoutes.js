const express = require('express');
const router = express.Router();
const restaurants = require('../data/restaurants');

// Get all restaurants
router.get('/', (req, res) => {
    res.json(restaurants);
});

// Get a single restaurant by ID
router.get('/:id', (req, res) => {
    const restaurant = restaurants.find(r => r.id === req.params.id);
    if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
    }
    res.json(restaurant);
});

// Get restaurants by cuisine type
router.get('/cuisine/:type', (req, res) => {
    const filteredRestaurants = restaurants.filter(
        r => r.cuisine.toLowerCase() === req.params.type.toLowerCase()
    );
    res.json(filteredRestaurants);
});

module.exports = router;
