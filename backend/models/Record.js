// backend/models/Record.js
const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
    recordId: { type: String, required: true, unique: true },
    ownerEmail: { type: String, required: true },
    hashHex: { type: String, required: true }, 
    storageUrl: { type: String, required: true }, 
    blockchainTx: { type: String }, 
    status: { type: String, default: 'Pending Verification' },
});

module.exports = mongoose.model('Record', recordSchema);