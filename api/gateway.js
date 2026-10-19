// Pintu masuk cadangan: vercel.json mengarahkan /api/<nama> ke sini (?name=<nama>).
// Dipakai agar API tetap jalan walau file [...path].js bermasalah.
module.exports = require('./_adapter.js');
