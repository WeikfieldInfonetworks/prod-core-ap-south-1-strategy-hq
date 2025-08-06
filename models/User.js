const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
    user_id: {
        type: String,
        unique: true,
        default: uuidv4
    },
    name: String,
    api_key: String,
    secret_key: String,
    access_token: String
},{
    timestamps: { createdAt: true, updatedAt: true } 
});

module.exports = mongoose.model('User', userSchema);
