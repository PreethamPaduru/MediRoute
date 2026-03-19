function onGoogleMapsLoaded() {
  console.log("Google Maps API Loaded (Police)");
}

// Basic behavior borrowed from Captain app to mirror UX
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Splash → Login
setTimeout(() => showScreen('screen-login'), 1200);

// Simple login (client-side demo)
document.getElementById('btn-login').onclick = () => {
  const name = document.getElementById('cap-name').value.trim();
  const mobile = document.getElementById('cap-mobile').value.trim();
  if (!name || !mobile) return alert('Enter name and mobile number.');
  document.getElementById('cap-display-name').innerText = name;
  showScreen('screen-verify');
};

// Signup modal handlers
if (document.getElementById('cap-link-signup')) {
  document.getElementById('cap-link-signup').onclick = (e) => { e.preventDefault(); document.getElementById('cap-modal-signup').style.display = 'block'; };
}
if (document.getElementById('cap-close-signup')) document.getElementById('cap-close-signup').onclick = () => document.getElementById('cap-modal-signup').style.display = 'none';

// Verify proceed
if (document.getElementById('btn-verify')) {
  document.getElementById('btn-verify').onclick = () => {
    showScreen('screen-home');
    // wait for Google Maps to initialize
    let wait = setInterval(() => {
      if (typeof google !== 'undefined') {
        clearInterval(wait);
        if (document.getElementById('map')) {
          new google.maps.Map(document.getElementById('map'), { center: { lat: 17.4457, lng: 78.3658 }, zoom: 15, disableDefaultUI: true });
        }
      }
    }, 100);
  };
}

// Toggle online
if (document.getElementById('toggle-online')) document.getElementById('toggle-online').onchange = e => alert(e.target.checked ? 'ONLINE — waiting for incident updates' : 'OFFLINE');

// Accept / reject handlers
if (document.getElementById('btn-accept')) document.getElementById('btn-accept').onclick = () => { document.getElementById('req-popup').classList.add('hidden'); alert('Accepted'); };
if (document.getElementById('btn-reject')) document.getElementById('btn-reject').onclick = () => { document.getElementById('req-popup').classList.add('hidden'); };

/* --------------------------------------------------
   POLLING: Fetch requests for Police
   - Polls /police/pending every 3s when online
   - Shows popup for new waiting requests
   - Alerts when an active green corridor ambulance is near a junction
-------------------------------------------------- */
let policePollingInterval = null;
const POLICE_JUNCTIONS = [
  { lat: 17.4457, lng: 78.3658 },
  { lat: 17.4465, lng: 78.3668 },
  { lat: 17.4472, lng: 78.3675 },
  { lat: 17.4480, lng: 78.3681 }
];

function haversineKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2) * Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const aCalc = sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(aCalc), Math.sqrt(1 - aCalc));
  return R * c;
}

function showPoliceRequestPopup(req, label = 'Incident') {
  const popup = document.getElementById('req-popup');
  popup.classList.remove('hidden');
  document.getElementById('req-text').innerHTML = `
    <b>Pickup:</b> ${req.pickup.lat.toFixed(4)}, ${req.pickup.lng.toFixed(4)}<br>
    <b>Hospital:</b> ${req.hospital.name || req.hospital}<br>
    <b>Service:</b> ${req.service.name || req.service}<br>
    <small style="color:#666">${label}</small>
  `;
}

function startPolicePolling() {
  if (policePollingInterval) clearInterval(policePollingInterval);

  policePollingInterval = setInterval(() => {
    const isOnline = document.getElementById('toggle-online') && document.getElementById('toggle-online').checked;
    if (!isOnline) return;

    fetch('http://localhost:5000/police/pending')
      .then(res => res.json())
      .then(data => {
        if (!data.success) return;

        if (data.pending && data.pending.length > 0) {
          // show first waiting request (like Captain app)
          showPoliceRequestPopup(data.pending[0], 'New Request — Waiting');
        }

        if (data.active && data.active.length > 0) {
          // For each active emergency, if captainLocation exists and near a junction, notify police
          data.active.forEach(req => {
            if (req.captainLocation && req.captainLocation.lat && req.captainLocation.lng) {
              for (const j of POLICE_JUNCTIONS) {
                const dkm = haversineKm(j, req.captainLocation);
                // notify if within 0.3 km (~300m)
                if (dkm <= 0.3) {
                  showPoliceRequestPopup(req, 'Approaching Junction — Green Corridor');
                  break;
                }
              }
            }
          });
        }
      })
      .catch(err => console.log('Police polling error:', err));

  }, 3000);
}

// Start polling when user toggles online
if (document.getElementById('toggle-online')) {
  document.getElementById('toggle-online').onchange = (e) => {
    if (e.target.checked) {
      alert('ONLINE — waiting for incident updates');
      startPolicePolling();
    } else {
      alert('OFFLINE');
      if (policePollingInterval) { clearInterval(policePollingInterval); policePollingInterval = null; }
    }
  };
}

// If already on home screen and toggle is checked, start polling
setTimeout(() => {
  if (document.getElementById('toggle-online') && document.getElementById('toggle-online').checked) startPolicePolling();
}, 1000);
