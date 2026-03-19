const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
  role: { type: String, enum: ['rider', 'captain', 'hospital'], required: true },
  
  // Common fields
  name: { type: String },
  mobile: { type: String },
  password: { type: String, required: true },
  
  // Hospital specific
  hospitalName: { type: String },
  hospitalAddress: { type: String },
  contactPerson: { type: String },
  
  // Rider/Patient specific
  age: { type: Number },
  bloodGroup: { type: String },
  emergencyContact: { type: String },
  medicalHistory: { type: String },
  
  // Captain specific
  licenseNumber: { type: String },
  licenseExpiry: { type: Date },
  ambulanceNumber: { type: String },
  ambulanceType: { type: String },
  ambulanceModel: { type: String },
  insuranceNumber: { type: String },
  insuranceExpiry: { type: Date },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
