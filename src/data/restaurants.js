// Fixed restaurant locations in Sidi Bel Abbès
const restaurants = [
    {
        id: 'rest1',
        name: 'Pizza Express',
        description: 'Best Italian pizza in town',
        location: {
            type: 'Point',
            coordinates: [-0.6306, 35.1992] // Center of Sidi Bel Abbès
        },
        address: 'Place 1er Novembre, Sidi Bel Abbès',
        cuisine: 'Italian',
        rating: 4.5
    },
    {
        id: 'rest2',
        name: 'Burger Kingdom',
        description: 'Premium burgers and fries',
        location: {
            type: 'Point',
            coordinates: [-0.6376, 35.2022] // Northeast of center
        },
        address: 'Avenue Emir Abdelkader, Sidi Bel Abbès',
        cuisine: 'American',
        rating: 4.2
    },
    {
        id: 'rest3',
        name: 'Couscous Palace',
        description: 'Traditional Algerian cuisine',
        location: {
            type: 'Point',
            coordinates: [-0.6246, 35.1962] // East of center
        },
        address: 'Rue Larbi Ben M\'Hidi, Sidi Bel Abbès',
        cuisine: 'Algerian',
        rating: 4.7
    },
    {
        id: 'rest4',
        name: 'Chicken House',
        description: 'Grilled chicken specialties',
        location: {
            type: 'Point',
            coordinates: [-0.6366, 35.1952] // Southeast of center
        },
        address: 'Boulevard Colonel Amirouche, Sidi Bel Abbès',
        cuisine: 'Fast Food',
        rating: 4.0
    },
    {
        id: 'rest5',
        name: 'Pasta Paradise',
        description: 'Fresh pasta and Italian dishes',
        location: {
            type: 'Point',
            coordinates: [-0.6236, 35.2032] // Northeast of center
        },
        address: 'Rue Mohamed Khemisti, Sidi Bel Abbès',
        cuisine: 'Italian',
        rating: 4.3
    }
];

module.exports = restaurants;
