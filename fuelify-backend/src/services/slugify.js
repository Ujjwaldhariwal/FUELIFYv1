// fuelify-backend/src/services/slugify.js
// Generates a URL-safe slug from station name + city + state
const generateSlug = (name, street, city, state) => {
  const raw = `${name} ${street} ${city} ${state}`;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

module.exports = { generateSlug };
