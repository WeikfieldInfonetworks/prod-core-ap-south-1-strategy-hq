const mongoose = require('mongoose');

const tickSchema = new mongoose.Schema({
    instrument_token: Number,
    symbol: String,
    last_price: Number,
    timestamp: String
})

module.exports = mongoose.model('Tick', tickSchema);