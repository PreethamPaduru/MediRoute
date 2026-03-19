// =====================================================
// Medi-Route Rider App – Google Maps Full Version
// =====================================================

let currentScreen = "splash";
let homeMap = null;
let trackMap = null;
let homeMarker = null;
let trackMarker = null;

let pickup = { lat: 17.4457, lng: 78.3658 };
let chosenService = null;
let userName = "";
let userMobile = "";
let currentRequestId = null;
let googleMapsReady = false;

// User profile (persisted after signup)
let userProfile = JSON.parse(localStorage.getItem('userProfile') || 'null');
if (userProfile) {
  userName = userProfile.name || '';
  userMobile = userProfile.mobile || '';
}

// ---------------- DATA ----------------
let hospitals = [];

const services = [
  { id: "BLS", name: "Basic Life Support (BLS)", base: 250, perKm: 20 },
  { id: "ALS", name: "Advanced Life Support (ALS)", base: 450, perKm: 35 },
  { id: "MICU", name: "Mobile ICU (MICU)", base: 700, perKm: 50 }
];

// =====================================================
// GOOGLE MAPS LOADER
// =====================================================
function onGoogleMapsLoaded() {
  googleMapsReady = true;
  console.log("✅ Google Maps Loaded");
}

// =====================================================
// SCREEN HANDLING
// =====================================================
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
    s.style.display = "none";
  });

  const screen = document.getElementById("screen-" + name);
  if (screen) {
    screen.style.display = "flex";
    screen.classList.add("active");
  }
}

// Splash → Login
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => showScreen("login"), 1200);
});

// =====================================================
// LOGIN
// =====================================================
document.getElementById("btn-login-continue").onclick = async () => {
  const name = document.getElementById("login-name").value.trim();
  const mobile = document.getElementById("login-mobile").value.trim();

  console.log('LOGIN: Continue clicked', { name, mobile });

  if (!name || !mobile) {
    alert("Enter name and mobile number");
    return;
  }

  // Ensure signup modal is closed if it was accidentally left open
  const modal = document.getElementById('modal-signup');
  if (modal) modal.style.display = 'none';

  // Allow continuing as guest if user hasn't created an account yet
  const token = localStorage.getItem('token');
  if (!token && !userProfile) {
    // Proceed as guest but save the info for this session
    userName = name;
    userMobile = mobile;
    // Create a temporary profile for this session
    userProfile = { name, mobile };

    console.log('LOGIN: Proceeding as guest with profile', userProfile);
    // Non-blocking notification
    const tip = document.createElement('div');
    tip.style.position = 'fixed';
    tip.style.right = '12px';
    tip.style.top = '12px';
    tip.style.background = '#111';
    tip.style.color = '#fff';
    tip.style.padding = '8px 12px';
    tip.style.borderRadius = '8px';
    tip.style.zIndex = 9999;
    tip.innerText = 'Continuing as guest. Emergency details saved for this session.';
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 3500);
  } else {
    // Proceed as logged-in user or with saved profile
    userName = name;
    userMobile = mobile;
    if (userProfile) {
      console.log('LOGIN: Using saved profile', userProfile);
    }
  }
}

try {
  waitForGoogleMaps(initHome);
  showScreen("home");
  console.log('LOGIN: Navigated to home');
} catch (err) {
  console.error('LOGIN: Failed to go home', err);
  alert('Unable to proceed to Home due to an error. Check console for details.');
}
};

// SIGNUP FLOW (modal open/close + API call)
document.getElementById('link-signup').onclick = (e) => {
  e.preventDefault();
  document.getElementById('modal-signup').style.display = 'block';
};

document.getElementById('btn-close-signup').onclick = () => {
  document.getElementById('modal-signup').style.display = 'none';
};

document.getElementById('btn-signup').onclick = async () => {
  const name = document.getElementById('signup-name').value.trim();
  const mobile = document.getElementById('signup-mobile').value.trim();
  const age = document.getElementById('signup-age').value.trim();
  const bloodGroup = document.getElementById('signup-blood').value;
  const emergencyContact = document.getElementById('signup-emergency').value.trim();
  const medicalHistory = document.getElementById('signup-medical').value.trim();
  const password = document.getElementById('signup-password').value.trim();

  if (!name || !mobile || !age || !bloodGroup || !emergencyContact || !password) {
    alert('Please fill all required fields');
    return;
  }

  try {
    const res = await fetch('http://localhost:5000/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'rider',
        name,
        mobile,
        password,
        age: parseInt(age),
        bloodGroup,
        emergencyContact,
        medicalHistory
      })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      userProfile = { name, mobile, age: parseInt(age), bloodGroup, emergencyContact, medicalHistory };
      localStorage.setItem('userProfile', JSON.stringify(userProfile));
      userName = name;
      userMobile = mobile;
      document.getElementById('modal-signup').style.display = 'none';
      waitForGoogleMaps(initHome);
      showScreen('home');
    } else {
      alert(data.message || 'Signup failed');
    }
  } catch (err) {
    console.error('Signup failed', err);
    alert('Signup failed');
  }
};

// =====================================================
// WAIT FOR GOOGLE MAPS
// =====================================================
function waitForGoogleMaps(cb) {
  let t = setInterval(() => {
    if (googleMapsReady && typeof google !== "undefined") {
      clearInterval(t);
      cb();
    }
  }, 100);
}

// =====================================================
// HOME MAP INIT
// =====================================================
let homeInitialized = false;

async function initHome() {
  if (homeInitialized) return;
  homeInitialized = true;

  homeMap = new google.maps.Map(document.getElementById("home-map"), {
    center: pickup,
    zoom: 15,
    disableDefaultUI: true,
    styles: [
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
      { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] }
    ]
  });

  homeMarker = new google.maps.Marker({
    position: pickup,
    map: homeMap,
    title: "Pickup"
  });

  // FETCH HOSPITALS
  try {
    const res = await fetch("http://localhost:5000/data/hospitals");
    const data = await res.json();
    if (data.success) hospitals = data.hospitals;
  } catch (e) {
    hospitals = [
      { id: "H1", name: "Govt General Hospital", lat: 17.4470, lng: 78.3672 }
    ];
  }

  const select = document.getElementById("hospital-select");
  select.innerHTML = "";
  hospitals.forEach(h => {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = h.name;
    select.appendChild(opt);
  });

  updateEstimate();
}

// =====================================================
// LOCATION
// =====================================================
document.getElementById("btn-use-location").onclick = () => {
  navigator.geolocation.getCurrentPosition(pos => {
    pickup.lat = pos.coords.latitude;
    pickup.lng = pos.coords.longitude;

    document.getElementById("pickup-input").value = "Current Location";

    homeMarker.setPosition(pickup);
    homeMap.panTo(pickup);

    updateEstimate();
  });
};

document.getElementById("hospital-select").onchange = updateEstimate;

// =====================================================
// ESTIMATE
// =====================================================
function approxDistanceKm(a, b) {
  return Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2) * 111;
}

function updateEstimate() {
  const selectedId = document.getElementById("hospital-select").value;
  const hospital = hospitals.find(h => h.id === selectedId) || hospitals[0];
  if (!hospital) return;

  const dist = approxDistanceKm(pickup, hospital);
  document.getElementById("home-time").innerText = Math.round(5 + dist * 2) + " min";
  document.getElementById("home-fare").innerText =
    "₹" + Math.round(services[0].base + dist * services[0].perKm);
}

// =====================================================
// AMBULANCE OPTIONS
// =====================================================
document.getElementById("btn-ride-options").onclick = () => {
  const list = document.getElementById("options-list");
  list.innerHTML = "";
  chosenService = null;

  services.forEach(s => {
    const card = document.createElement("div");
    card.className = "option-card";
    card.innerHTML = `<b>${s.name}</b> – ₹${s.base}`;
    card.onclick = () => {
      document.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      chosenService = s;
    };
    list.appendChild(card);
  });

  showScreen("options");
};

document.getElementById("btn-options-back").onclick = () => showScreen("home");

// =====================================================
// BOOK RIDE
// =====================================================
document.getElementById("btn-confirm-ride").onclick = () => {
  if (!chosenService) {
    alert("Select ambulance type");
    return;
  }
  sendRideRequest(chosenService);
};

function sendRideRequest(service) {
  const selectedId = document.getElementById("hospital-select").value;
  const selectedHospital = hospitals.find(h => h.id === selectedId) || hospitals[0];

  // Build rider info from profile or quick inputs
  const riderInfo = userProfile ? { ...userProfile } : { name: userName, mobile: userMobile };

  // Blood group should now be in userProfile from Login or Signup


  fetch("http://localhost:5000/rider/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pickup, hospital: selectedHospital.name, service, rider: riderInfo })
  })
    .then(res => res.json())
    .then(data => {
      currentRequestId = data.request.id;
      showScreen("searching");
      pollCaptain();
    });
}

function pollCaptain() {
  const timer = setInterval(() => {
    fetch("http://localhost:5000/rider/status/" + currentRequestId)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.request.status === "accepted") {
          clearInterval(timer);
          startTracking();
        }
      });
  }, 2000);
}

// =====================================================
// TRACKING
// =====================================================
function startTracking() {
  if (!trackMap) {
    trackMap = new google.maps.Map(document.getElementById("track-map"), {
      center: pickup,
      zoom: 15,
      disableDefaultUI: true
    });

    trackMarker = new google.maps.Marker({
      position: pickup,
      map: trackMap,
      title: "Ambulance"
    });
  }

  showScreen("tracking");
}

// =====================================================
// VOICE EMERGENCY BOOKING
// =====================================================
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = SpeechRecognition ? new SpeechRecognition() : null;

const EMERGENCY_KEYWORDS = [
  "emergency", "help", "save me", "accident", "heart attack",
  "bleeding", "unconscious", "collapse", "injured", "critical"
];

document.getElementById("btn-voice-emergency").onclick = () => {
  if (!recognition) {
    alert("Voice recognition not supported");
    return;
  }

  recognition.start();
  speak("Listening for emergency");
};

if (recognition) {
  recognition.lang = "en-IN";
  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript.toLowerCase();
    console.log("🎤 Voice:", text);

    const isEmergency = EMERGENCY_KEYWORDS.some(w => text.includes(w));

    if (isEmergency) {
      speak("Emergency detected. Booking ambulance.");
      autoBookEmergency();
    } else {
      speak("Emergency not detected. Please repeat clearly.");
    }
  };

  recognition.onerror = () => speak("Voice error. Try again.");
}

// =====================================================
// AUTO EMERGENCY BOOKING
// =====================================================
function autoBookEmergency() {
  // Include rider info in emergency booking as well
  const riderInfo = userProfile ? { ...userProfile } : { name: userName, mobile: userMobile };
  if (!riderInfo.bloodGroup) {
    const bg = prompt('Enter patient\'s blood group for emergency (e.g. A+, O-, AB+). Leave blank if unknown.');
    if (bg) riderInfo.bloodGroup = bg.trim();
  }

  fetch("http://localhost:5000/rider/emergency", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pickup,
      hospital: hospitals[0],
      service: services[0],
      rider: riderInfo
    })
  })
    .then(res => res.json())
    .then(data => {
      currentRequestId = data.request.id;
      showScreen("searching");
      pollCaptain();
    });
}

// =====================================================
// VOICE OUTPUT
// =====================================================
function speak(message) {
  const msg = new SpeechSynthesisUtterance(message);
  msg.lang = "en-IN";
  speechSynthesis.cancel();
  speechSynthesis.speak(msg);
}

console.log("✅ Rider Google Maps full system loaded");
