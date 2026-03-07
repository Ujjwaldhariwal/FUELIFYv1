// fuelify-backend/src/services/placesAPI.js
const axios = require('axios');

const BASE_URL = 'https://maps.googleapis.com/maps/api/place';

// Search nearby gas stations for a given lat/lng within radius (meters)
const searchNearbyStations = async (lat, lng, radius = 50000) => {
  const url = `${BASE_URL}/nearbysearch/json`;
  const params = {
    location: `${lat},${lng}`,
    radius,
    type: 'gas_station',
    key: process.env.GOOGLE_PLACES_API_KEY,
  };

  const response = await axios.get(url, { params });
  return response.data.results || [];
};

// Get detailed info for a single place by placeId
const getPlaceDetails = async (placeId) => {
  const url = `${BASE_URL}/details/json`;
  const params = {
    place_id: placeId,
    fields: 'place_id,name,formatted_address,geometry,formatted_phone_number,website,opening_hours',
    key: process.env.GOOGLE_PLACES_API_KEY,
  };

  const response = await axios.get(url, { params });
  return response.data.result || null;
};

module.exports = { searchNearbyStations, getPlaceDetails };
