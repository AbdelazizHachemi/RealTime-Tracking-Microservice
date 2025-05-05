const express = require('express');
const router = express.Router();
const Driver = require('../models/Driver');
const { body, validationResult } = require('express-validator');

// Get all drivers
router.get('/', async (req, res) => {
  try {
    const drivers = await Driver.find();
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get nearby drivers
router.get('/nearby', async (req, res) => {
  const { longitude, latitude, maxDistance = 5000 } = req.query;
  
  if (!longitude || !latitude) {
    return res.status(400).json({ message: 'Longitude and latitude are required' });
  }

  try {
    const drivers = await Driver.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      },
      status: 'available'
    });
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update driver location
router.put('/:id/location', [
  body('longitude').isFloat(),
  body('latitude').isFloat()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    driver.location = {
      type: 'Point',
      coordinates: [req.body.longitude, req.body.latitude]
    };
    driver.lastUpdated = new Date();
    
    await driver.save();
    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update driver status
router.put('/:id/status', [
  body('status').isIn(['available', 'busy', 'offline'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    driver.status = req.body.status;
    await driver.save();
    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 