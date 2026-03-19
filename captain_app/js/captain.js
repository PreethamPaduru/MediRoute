function onGoogleMapsLoaded() {
  console.log("Google Maps API Loaded");
}

/* --------------------------------------------------
   GLOBAL VARIABLES
-------------------------------------------------- */
let map = null;
let ambulanceMarker = null;
let captainId = "CAP-" + Math.floor(Math.random() * 9000 + 1000);
let verifiedAmbulance = false;
let currentReqId = null;
let pollingInterval = null;

/* Fake signal model (UI only, not real corridor engine) */
let signals = [
  { name: "Junction 1", status: "RED" },
  { name: "Junction 2", status: "RED" },
  { name: "Junction 3", status: "RED" }
];

/* --------------------------------------------------
   SCREEN SWITCH
-------------------------------------------------- */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* --------------------------------------------------
   SPLASH → LOGIN
-------------------------------------------------- */
setTimeout(() => {
  showScreen("screen-login");
}, 1500);

/* --------------------------------------------------
   LOGIN
-------------------------------------------------- */
document.getElementById("btn-login").onclick = () => {
  let name = document.getElementById("cap-name").value.trim();
  let mobile = document.getElementById("cap-mobile").value.trim();

  if (!name || !mobile) {
    alert("Enter name and mobile number.");
    return;
  }

  document.getElementById("cap-display-name").innerText = name;
  showScreen("screen-verify");
};

// Signup modal handlers
document.getElementById('cap-link-signup').onclick = (e) => {
  e.preventDefault();
  document.getElementById('cap-modal-signup').style.display = 'block';
};

document.getElementById('cap-close-signup').onclick = () => {
  document.getElementById('cap-modal-signup').style.display = 'none';
};

// Signup API
document.getElementById('cap-btn-signup').onclick = async () => {
  const name = document.getElementById('cap-sign-name').value.trim();
  const mobile = document.getElementById('cap-sign-mobile').value.trim();
  const licenseNumber = document.getElementById('cap-license-num').value.trim();
  const licenseExpiry = document.getElementById('cap-license-exp').value;
  const ambulanceNumber = document.getElementById('cap-amb-num').value.trim();
  const ambulanceType = document.getElementById('cap-amb-type').value;
  const ambulanceModel = document.getElementById('cap-amb-model').value.trim();
  const insuranceNumber = document.getElementById('cap-insurance-num').value.trim();
  const insuranceExpiry = document.getElementById('cap-insurance-exp').value;
  const password = document.getElementById('cap-sign-password').value.trim();

  if (!name || !mobile || !licenseNumber || !licenseExpiry || !ambulanceNumber || !ambulanceType || !ambulanceModel || !insuranceNumber || !insuranceExpiry || !password) {
    alert('Please fill all required fields');
    return;
  }

  try {
    const res = await fetch('http://localhost:5000/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        role: 'captain', 
        name, 
        mobile, 
        password,
        licenseNumber,
        licenseExpiry,
        ambulanceNumber,
        ambulanceType,
        ambulanceModel,
        insuranceNumber,
        insuranceExpiry
      })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      document.getElementById('cap-modal-signup').style.display = 'none';
      
      // Clear the login form and show verification screen
      document.getElementById('cap-name').value = name;
      document.getElementById('cap-display-name').innerText = name;
      document.getElementById('cap-display-amb').innerText = `${ambulanceType} • ${ambulanceNumber}`;
      
      // Auto-proceed to verification with pre-filled data
      document.getElementById('amb-number').value = ambulanceNumber;
      document.getElementById('amb-model').value = ambulanceModel;
      document.getElementById('amb-type').value = ambulanceType;
      
      alert('Account created successfully! Proceeding to verification...');
      showScreen('screen-verify');
    } else {
      alert(data.message || 'Signup failed');
    }
  } catch (err) {
    console.error(err);
    alert('Signup failed');
  }
};

/* --------------------------------------------------
   VERIFICATION
-------------------------------------------------- */
document.getElementById("btn-verify").onclick = () => {
  let ambNo = document.getElementById("amb-number").value.trim();
  let ambModel = document.getElementById("amb-model").value.trim();
  let ambType = document.getElementById("amb-type").value;

  if (!ambNo || !ambModel) {
    alert("Fill ambulance details.");
    return;
  }

  verifiedAmbulance = true;
  document.getElementById("cap-display-amb").innerText =
    `${ambType} • ${ambNo}`;

  showScreen("screen-home");

/* wait until google exists */
let wait = setInterval(() => {
  if (typeof google !== "undefined") {
    clearInterval(wait);
    initMap(17.4457, 78.3658);
    startPollingRequests();
  }
}, 100);

};

/* --------------------------------------------------
   GOOGLE MAP INIT
-------------------------------------------------- */
function initMap(lat, lng) {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat, lng },
    zoom: 15,
    disableDefaultUI: true
  });

  ambulanceMarker = new google.maps.Marker({
    position: { lat, lng },
    map: map,
    title: "Ambulance",
    icon: "images/ambulance.png"
  });
}

/* --------------------------------------------------
   SIGNAL UI
-------------------------------------------------- */
function renderSignals() {
  let box = document.getElementById("signal-list");
  box.innerHTML = "";

  signals.forEach(sig => {
    let div = document.createElement("div");
    div.className = "signal-item";
    div.innerHTML = `
      <span>${sig.name}</span>
      <span class="${sig.status === "GREEN" ? "signal-status-green" : "signal-status-red"}">
        ${sig.status}
      </span>
    `;
    box.appendChild(div);
  });
}

/* --------------------------------------------------
   ONLINE / OFFLINE
-------------------------------------------------- */
document.getElementById("toggle-online").onchange = (e) => {
  if (e.target.checked) {
    alert("ONLINE — waiting for emergency requests");
  } else {
    alert("OFFLINE");
  }
};

/* --------------------------------------------------
   POLLING REQUESTS (TEMP SYSTEM)
-------------------------------------------------- */
function startPollingRequests() {
  if (pollingInterval) clearInterval(pollingInterval);

  pollingInterval = setInterval(() => {
    let isOnline = document.getElementById("toggle-online").checked;
    if (!isOnline) return;

    fetch("http://localhost:5000/captain/pending")
      .then(res => res.json())
      .then(data => {
        if (data.pending && data.pending.length > 0) {
          let req = data.pending[0];
          showRequestPopup(req);
        }
      })
      .catch(err => console.log("Polling error:", err));

  }, 3000);
}

/* --------------------------------------------------
   REQUEST POPUP
-------------------------------------------------- */
function showRequestPopup(req) {
  let popup = document.getElementById("req-popup");
  popup.classList.remove("hidden");

  document.getElementById("req-text").innerHTML = `
    <b>Pickup:</b> ${req.pickup.lat.toFixed(4)}, ${req.pickup.lng.toFixed(4)}<br>
    <b>Hospital:</b> ${req.hospital.name || req.hospital}<br>
    <b>Service:</b> ${req.service.name || req.service}
  `;

  document.getElementById("btn-accept").onclick = () => {
    popup.classList.add("hidden");
    acceptRequest(req.id);
  };

  document.getElementById("btn-reject").onclick = () => {
    popup.classList.add("hidden");
  };
}

/* --------------------------------------------------
   ACCEPT REQUEST
-------------------------------------------------- */
function acceptRequest(id) {
  fetch("http://localhost:5000/captain/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId: id, captainId })
  });

  currentReqId = id;
  startTripMovement();
}

/* --------------------------------------------------
   SIMULATED TRIP MOVEMENT
   (NOT REAL ROUTING — JUST DEMO ENGINE)
-------------------------------------------------- */
function startTripMovement() {

  /* Fake path */
  let path = [
    { lat: 17.4457, lng: 78.3658 },
    { lat: 17.4465, lng: 78.3668 },
    { lat: 17.4472, lng: 78.3675 },
    { lat: 17.4480, lng: 78.3681 }
  ];

  let p = 0;

  let interval = setInterval(() => {

    if (p >= path.length) {
      clearInterval(interval);

      /* Complete ride */
      fetch("http://localhost:5000/captain/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: currentReqId })
      }).then(() => {
        alert("Trip completed. Ambulance reached hospital.");
        location.reload();
      });

      return;
    }

    let pos = path[p];

    /* Move marker */
    ambulanceMarker.setPosition(pos);
    map.panTo(pos);

    /* Send location to backend */
    if (currentReqId) {
      fetch("http://localhost:5000/captain/update-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: currentReqId,
          lat: pos.lat,
          lng: pos.lng
        })
      }).catch(err => console.log("Location update failed"));
    }

    /* Fake green corridor UI logic */
    if (p === 1) signals[0].status = "GREEN";
    if (p === 2) signals[1].status = "GREEN";
    if (p === 3) signals[2].status = "GREEN";

    renderSignals();

    p++;

  }, 2200);
}
