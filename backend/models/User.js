// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['patient', 'doctor'], default: 'patient' },
    name: { type: String },
    phone: { type: String },
    iin: { type: String }, 
    zkpPublicKey: { type: String, default: null }
});

module.exports = mongoose.model('User', userSchema);