const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ---- DATABASE / AUTH SETUP ----
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/medi-route';
let dbConnected = false;

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('✅ MongoDB connected');
    dbConnected = true;
  })
  .catch((err) => {
    console.error('⚠️ MongoDB not connected (Running in Offline Mode). Auth will be disabled.');
    // Do not crash, just let the server run for requests.json
  });

function generateToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '7d'
  });
}

const DATA_FILE = path.join(__dirname, "data", "requests.json");

/* --------------------------------------------
   FILE HELPERS
-------------------------------------------- */
function loadRequests() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveRequests(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* --------------------------------------------
   🏥 0️⃣ FETCH HOSPITALS LIST
-------------------------------------------- */
app.get("/data/hospitals", (req, res) => {
  const hospitals = [
    { id: "H1", name: "Govt General Hospital", lat: 17.4470, lng: 78.3672 },
    { id: "H2", name: "Neelima Hospitals", lat: 17.4480, lng: 78.3689 },
    { id: "H3", name: "Surya Hospital", lat: 17.4465, lng: 78.3649 },
    { id: "H4", name: "Apollo Hospital", lat: 17.4450, lng: 78.3660 } // Added Apollo for demo match
  ];
  res.json({ success: true, hospitals });
});

/* --------------------------------------------
   1️⃣ NORMAL RIDER REQUEST
-------------------------------------------- */
app.post("/rider/request", (req, res) => {
  const { pickup, hospital, service, rider } = req.body;

  const requests = loadRequests();

  const newReq = {
    id: "REQ-" + Date.now(),
    pickup,
    hospital,
    service,
    rider: rider || null,
    status: "waiting",
    captain: null,
    acceptedAt: null,
    emergency: false,
    greenCorridor: false,
    timestamp: Date.now()
  };

  requests.push(newReq);
  saveRequests(requests);

  res.json({ success: true, request: newReq });
});

/* --------------------------------------------
   🚨 2️⃣ EMERGENCY RIDER REQUEST
-------------------------------------------- */
app.post("/rider/emergency", (req, res) => {
  const { pickup, hospital, service, rider } = req.body;

  const requests = loadRequests();

  const newReq = {
    id: "REQ-" + Date.now(),
    pickup,
    hospital,
    service,
    rider: rider || null,
    status: "waiting",
    captain: null,
    acceptedAt: null,
    emergency: true,
    greenCorridor: false,
    timestamp: Date.now()
  };

  requests.push(newReq);
  saveRequests(requests);

  console.log("🚨 EMERGENCY REQUEST RECEIVED:", newReq.id);

  res.json({ success: true, request: newReq });
});

/* --------------------------------------------
   3️⃣ CAPTAIN FETCH PENDING REQUESTS
-------------------------------------------- */
app.get("/captain/pending", (req, res) => {
  const requests = loadRequests();
  const waiting = requests.filter(r => r.status === "waiting");
  res.json({ success: true, pending: waiting });
});

/* --------------------------------------------
   3️⃣.1️⃣ POLICE FETCH PENDING / ACTIVE REQUESTS
   Returns both new waiting requests and active emergencies
-------------------------------------------- */
app.get("/police/pending", (req, res) => {
  const requests = loadRequests();
  const waiting = requests.filter(r => r.status === "waiting");
  const active = requests.filter(r => r.status === "accepted" && r.greenCorridor === true);
  res.json({ success: true, pending: waiting, active });
});

/* --------------------------------------------
   4️⃣ CAPTAIN ACCEPT REQUEST
-------------------------------------------- */
app.post("/captain/accept", (req, res) => {
  const { requestId, captainId } = req.body;

  const requests = loadRequests();
  const index = requests.findIndex(r => r.id === requestId);

  if (index === -1) {
    return res.json({ success: false, message: "Request not found" });
  }

  requests[index].status = "accepted";
  requests[index].captain = captainId;
  requests[index].acceptedAt = Date.now();

  // ✅ Activate green corridor ONLY for emergencies
  if (requests[index].emergency) {
    requests[index].greenCorridor = true;
    console.log("🟢 Green Corridor Activated:", requestId);
  }

  saveRequests(requests);

  res.json({ success: true, request: requests[index] });
});

/* --------------------------------------------
   4️⃣.2️⃣ CAPTAIN LOCATION UPDATE
-------------------------------------------- */
app.post("/captain/update-location", (req, res) => {
  const { requestId, lat, lng } = req.body;
  const requests = loadRequests();
  const index = requests.findIndex(r => r.id === requestId);

  if (index !== -1) {
    requests[index].captainLocation = { lat, lng };
    saveRequests(requests);
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

/* --------------------------------------------
   4️⃣.5️⃣ CAPTAIN COMPLETE RIDE
-------------------------------------------- */
app.post("/captain/complete", (req, res) => {
  const { requestId } = req.body;
  const requests = loadRequests();
  const index = requests.findIndex(r => r.id === requestId);

  if (index === -1) return res.json({ success: false });

  requests[index].status = "completed";
  requests[index].greenCorridor = false; // Turn off lights
  requests[index].completedAt = Date.now();

  saveRequests(requests);
  console.log("✅ Ride Completed:", requestId);

  res.json({ success: true });
});

/* --------------------------------------------
   5️⃣ RIDER POLLS REQUEST STATUS
-------------------------------------------- */
app.get("/rider/status/:id", (req, res) => {
  const { id } = req.params;
  const requests = loadRequests();
  const reqData = requests.find(r => r.id === id);

  if (!reqData) {
    return res.json({ success: false, message: "Request not found" });
  }

  res.json({ success: true, request: reqData });
});

/* --------------------------------------------
   🚦 6️⃣ TRAFFIC ENGINE FETCH ACTIVE EMERGENCY
-------------------------------------------- */
app.get("/traffic/active", (req, res) => {
  const requests = loadRequests();

  const active = requests.find(
    r => r.status === "accepted" && r.greenCorridor === true
  );

  res.json({ success: true, request: active || null });
});

/* --------------------------------------------
   🏥 7️⃣ HOSPITAL FETCH REQUESTS
-------------------------------------------- */
app.get("/hospital/requests", (req, res) => {
  const { name } = req.query; // e.g. ?name=Apollo
  if (!name) return res.json({ success: false, message: "Hospital name required" });

  const requests = loadRequests();

  // Fetch both 'waiting' (just booked) and 'accepted' (en route) requests for this hospital
  const hospitalRequests = requests.filter(r =>
    r.hospital === name &&
    (r.status === "waiting" || r.status === "accepted")
  );

  res.json({ success: true, requests: hospitalRequests });
});

/* --------------------------------------------
   🔐 AUTH: Signup / Login
-------------------------------------------- */
app.post('/auth/signup', async (req, res) => {
  try {
    const { role, name, mobile, password, age, bloodGroup, emergencyContact, medicalHistory, licenseNumber, licenseExpiry, ambulanceNumber, ambulanceType, ambulanceModel, insuranceNumber, insuranceExpiry, hospitalName, hospitalAddress, contactPerson } = req.body;

    if (!role || !password || (!mobile && !hospitalName)) {
      return res.status(400).json({ success: false, message: 'role, password and (mobile or hospitalName) required' });
    }

    if (!dbConnected) {
      return res.json({ success: false, message: "Server is in Offline Mode. Please use Guest Login." });
    }

    let existing;
    if (role === 'hospital' && hospitalName) {
      existing = await User.findOne({ role, hospitalName });
    } else {
      existing = await User.findOne({ role, mobile });
    }

    if (existing) return res.json({ success: false, message: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);

    const userData = { role, name, mobile, password: hashed, hospitalName };

    // Add role-specific fields
    if (role === 'rider') {
      userData.age = age;
      userData.bloodGroup = bloodGroup;
      userData.emergencyContact = emergencyContact;
      userData.medicalHistory = medicalHistory;
    } else if (role === 'captain') {
      userData.licenseNumber = licenseNumber;
      userData.licenseExpiry = licenseExpiry;
      userData.ambulanceNumber = ambulanceNumber;
      userData.ambulanceType = ambulanceType;
      userData.ambulanceModel = ambulanceModel;
      userData.insuranceNumber = insuranceNumber;
      userData.insuranceExpiry = insuranceExpiry;
    } else if (role === 'hospital') {
      userData.hospitalAddress = hospitalAddress;
      userData.contactPerson = contactPerson;
    }

    const user = new User(userData);
    await user.save();

    const token = generateToken(user);
    res.json({ success: true, user: { id: user._id, role: user.role, name: user.name, mobile: user.mobile, hospitalName: user.hospitalName }, token });
  } catch (err) {
    console.error('Signup error', err);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { role, mobile, password, hospitalName } = req.body;

    let user;
    if (role === 'hospital' && hospitalName) {
      user = await User.findOne({ role, hospitalName });
    } else {
      user = await User.findOne({ role, mobile });
    }

    if (!user) return res.json({ success: false, message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.json({ success: false, message: 'Invalid credentials' });

    const token = generateToken(user);
    res.json({ success: true, user: { id: user._id, role: user.role, name: user.name, mobile: user.mobile, hospitalName: user.hospitalName }, token });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

/* --------------------------------------------
   🔐 AUTH — SIGNUP / LOGIN
-------------------------------------------- */
app.post('/auth/signup', async (req, res) => {
  try {
    const { role, name, mobile, password, hospitalName } = req.body;
    if (!role || !password || (!mobile && !hospitalName)) return res.status(400).json({ success: false, message: 'role + password + (mobile|hospitalName) required' });

    const query = role === 'hospital' ? { hospitalName, role } : { mobile, role };
    const exists = await User.findOne(query);
    if (exists) return res.json({ success: false, message: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ role, name, mobile, password: hashed, hospitalName });
    await user.save();

    const token = generateToken(user);
    res.json({ success: true, user: { id: user._id, role: user.role, name: user.name, mobile: user.mobile, hospitalName: user.hospitalName }, token });
  } catch (err) {
    console.error('Signup error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { role, mobile, password, hospitalName } = req.body;
    if (!dbConnected) return res.json({ success: false, message: "Server is in Offline Mode. Please use Guest Login." });

    if (!role || !password) return res.status(400).json({ success: false, message: 'role + password required' });

    let user = null;
    if (role === 'hospital' && hospitalName) {
      user = await User.findOne({ role: 'hospital', hospitalName });
    } else {
      user = await User.findOne({ role, mobile });
    }

    if (!user) return res.json({ success: false, message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.json({ success: false, message: 'Invalid credentials' });

    const token = generateToken(user);
    res.json({ success: true, user: { id: user._id, role: user.role, name: user.name, mobile: user.mobile, hospitalName: user.hospitalName }, token });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/auth/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.json({ success: false });
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    const user = await User.findById(payload.id).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.json({ success: false });
  }
});

/* --------------------------------------------
   START SERVER
-------------------------------------------- */
app.listen(5000, () => {
  console.log("🚑 Medi-Route Backend Running on http://localhost:5000");
});
