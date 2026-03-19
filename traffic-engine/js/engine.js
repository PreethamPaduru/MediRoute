/* ============================================
   Medi-Route Traffic AI Engine – Google Maps
============================================ */

// ---------------- GOOGLE MAPS ----------------
let map;
let googleMapsReady = false;

// Load callback
function onGoogleMapsLoaded() {
  googleMapsReady = true;
  initMap();
  console.log("✅ Traffic Engine Google Maps Loaded");
}

// Init map
function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 17.4457, lng: 78.3658 },
    zoom: 15,
    disableDefaultUI: true,
    styles: [
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] }
    ]
  });

  renderSignals();
}

// ---------------- SIGNAL DATA ----------------
let signals = [
  { id: "S1", name: "Junction 1", lat: 17.4465, lng: 78.3669, status: "RED", used: false },
  { id: "S2", name: "Junction 2", lat: 17.4472, lng: 78.3677, status: "RED", used: false },
  { id: "S3", name: "Junction 3", lat: 17.4480, lng: 78.3685, status: "RED", used: false }
];

let signalMarkers = [];
let ambulanceMarker = null;
let corridorStarted = false;

// ---------------- RENDER SIGNALS ----------------
function renderSignals() {
  const list = document.getElementById("signal-list");
  list.innerHTML = "";

  signals.forEach((s, i) => {
    // UI panel
    let row = document.createElement("div");
    row.className = "signal-item";
    row.innerHTML = `
      <span>${s.name}</span>
      <span class="badge ${s.status.toLowerCase()}">${s.status}</span>
    `;
    list.appendChild(row);

    // Color logic
    let color =
      s.status === "GREEN" ? "#22c55e" :
      s.status === "ORANGE" ? "#fb923c" :
      "#ef4444";

    // Map marker
    if (!signalMarkers[i]) {
      signalMarkers[i] = new google.maps.Circle({
        strokeColor: color,
        strokeOpacity: 1,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.85,
        map,
        center: { lat: s.lat, lng: s.lng },
        radius: 20
      });
    } else {
      signalMarkers[i].setOptions({
        strokeColor: color,
        fillColor: color
      });
    }
  });
}

// ---------------- AMBULANCE ROUTE ----------------
let path = [
  { lat: 17.4457, lng: 78.3658 },
  { lat: 17.4462, lng: 78.3662 },
  { lat: 17.4467, lng: 78.3669 },
  { lat: 17.4474, lng: 78.3676 },
  { lat: 17.4480, lng: 78.3682 }
];

// ---------------- SIGNAL ACTIVATION ----------------
function activateSignal(index) {
  if (signals[index].used) return;

  signals[index].used = true;
  signals[index].status = "GREEN";
  renderSignals();

  // GREEN → ORANGE
  setTimeout(() => {
    signals[index].status = "ORANGE";
    renderSignals();
  }, 3000);

  // ORANGE → RED
  setTimeout(() => {
    signals[index].status = "RED";
    renderSignals();
  }, 6000);
}

// ---------------- ANIMATION + GREEN CORRIDOR ----------------
function startAnimation() {
  if (!ambulanceMarker) {
    ambulanceMarker = new google.maps.Marker({
      position: path[0],
      map,
      title: "Ambulance",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#22c55e",
        fillOpacity: 1,
        strokeColor: "#22c55e",
        strokeWeight: 2
      }
    });
  }

  let i = 0;

  let interval = setInterval(() => {
    if (i >= path.length) {
      clearInterval(interval);

      // RESET SYSTEM
      corridorStarted = false;
      signals.forEach(s => {
        s.status = "RED";
        s.used = false;
      });
      renderSignals();

      console.log("✅ Green Corridor Completed & Reset");
      return;
    }

    let pos = path[i];
    ambulanceMarker.setPosition(pos);
    map.panTo(pos);

    // Status panel
    document.getElementById("amb-id").innerText = "AMB-01";
    document.getElementById("amb-road").innerText = `Road Segment ${i + 1}`;
    document.getElementById("amb-eta").innerText = (path.length - i) * 2 + " sec";

    // Trigger signals
    if (i === 2) activateSignal(0);
    if (i === 3) activateSignal(1);
    if (i === 4) activateSignal(2);

    i++;
  }, 2000);
}

// ---------------- AUTO BACKEND LISTENER ----------------
setInterval(() => {
  if (corridorStarted) return;

  fetch("http://localhost:5000/traffic/active")
    .then(res => res.json())
    .then(data => {
      if (data.request && data.request.greenCorridor) {
        console.log("🚨 Active Emergency → Auto Green Corridor");
        corridorStarted = true;
        startAnimation();
      }
    })
    .catch(err => console.error("Traffic Engine Error:", err));
}, 3000);

// ---------------- MANUAL DEMO BUTTON ----------------
document.getElementById("btn-start-corridor").onclick = () => {
  if (!corridorStarted) {
    corridorStarted = true;
    startAnimation();
  }
};
