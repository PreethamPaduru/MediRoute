/* Hospital App Logic – Google Maps संस्करण */

const screens = {
    login: document.getElementById('screen-login'),
    dashboard: document.getElementById('screen-dashboard')
};

const dom = {
    loginBtn: document.getElementById('btn-login'),
    hospitalSelect: document.getElementById('hospital-name'),
    displayHospital: document.getElementById('display-hospital-name'),
    logoutBtn: document.getElementById('btn-logout'),
    requestsList: document.getElementById('requests-list'),
    reqCount: document.getElementById('req-count')
};

let currentHospital = localStorage.getItem('hospitalName') || null;
let pollInterval = null;

// Google Maps
let googleMapsReady = false;
let map = null;
let marker = null;
let trackInterval = null;

// =====================================================
// GOOGLE MAPS LOADER
// =====================================================
function onGoogleMapsLoaded() {
    googleMapsReady = true;
    console.log("✅ Hospital Google Maps Loaded");
}

// =====================================================
// INIT
// =====================================================
function init() {
    loadHospitals();
    if (currentHospital) {
        showDashboard();
    } else {
        showScreen('login');
    }
}

// =====================================================
// LOAD HOSPITALS
// =====================================================
async function loadHospitals() {
    try {
        const res = await fetch("http://localhost:5000/data/hospitals");
        const data = await res.json();

        if (data.success) {
            const select = dom.hospitalSelect;
            select.innerHTML = '<option value="" disabled selected>Select Hospital</option>';

            data.hospitals.forEach(h => {
                const opt = document.createElement('option');
                opt.value = h.name; // backend filters by name
                opt.textContent = h.name;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("Failed to fetch hospitals", e);
    }
}

// =====================================================
// SCREEN CONTROL
// =====================================================
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

// =====================================================
// LOGIN FLOW
// =====================================================
dom.loginBtn.addEventListener('click', () => {
    const name = dom.hospitalSelect.value;
    if (!name) {
        alert('Please select a hospital');
        return;
    }
    currentHospital = name;
    localStorage.setItem('hospitalName', name);
    showDashboard();
    currentHospital = name;
    localStorage.setItem('hospitalName', name);
    showDashboard();
});

// SIGNUP FLOW
document.getElementById('link-signup').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('modal-signup').style.display = 'block';
});

document.getElementById('btn-close-signup').addEventListener('click', () => {
    document.getElementById('modal-signup').style.display = 'none';
});

document.getElementById('btn-signup').addEventListener('click', async () => {
    const name = document.getElementById('signup-name').value.trim();
    const address = document.getElementById('signup-address').value.trim();
    const contact = document.getElementById('signup-contact').value.trim();
    const password = document.getElementById('signup-password').value.trim();

    if (!name || !password) {
        alert('Hospital Name and Password are required');
        return;
    }

    try {
        const res = await fetch('http://localhost:5000/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                role: 'hospital',
                hospitalName: name,
                hospitalAddress: address,
                contactPerson: contact,
                password: password
            })
        });
        const data = await res.json();

        if (data.success) {
            alert('Hospital Registered Successfully!');
            document.getElementById('modal-signup').style.display = 'none';
            // Auto login or reload list
            loadHospitals();
            // Select the new hospital if possible, or just let them login
        } else {
            alert(data.message || 'Registration failed');
        }
    } catch (err) {
        console.error(err);
        alert('Server error');
    }
});

dom.logoutBtn.addEventListener('click', () => {
    currentHospital = null;
    localStorage.removeItem('hospitalName');
    clearInterval(pollInterval);
    showScreen('login');
});

// =====================================================
// DASHBOARD
// =====================================================
function showDashboard() {
    dom.displayHospital.textContent = currentHospital;
    showScreen('dashboard');
    fetchRequests();
    pollInterval = setInterval(fetchRequests, 3000);
}

async function fetchRequests() {
    try {
        const res = await fetch(`http://localhost:5000/hospital/requests?name=${encodeURIComponent(currentHospital)}`);
        const data = await res.json();

        if (data.success) {
            renderRequests(data.requests);
        }
    } catch (error) {
        console.error('Error fetching requests:', error);
    }
}

// =====================================================
// RENDER REQUESTS
// =====================================================
function renderRequests(requests) {
    dom.reqCount.textContent = requests.length;
    dom.requestsList.innerHTML = '';

    if (requests.length === 0) {
        dom.requestsList.innerHTML = `
            <div class="empty-state">
                <div class="radar-spinner small" style="border-color: #ddd;"></div>
                <p>No active emergency requests</p>
            </div>
        `;
        return;
    }

    requests.sort((a, b) => (b.emergency - a.emergency) || (a.timestamp - b.timestamp));

    requests.forEach(req => {
        const isEmergency = req.emergency;
        const statusClass = req.status === 'accepted' ? 'st-accepted' : 'st-waiting';
        const statusText = req.status === 'accepted' ? 'En Route (Captain Accepted)' : 'Waiting for Captain';

        const card = document.createElement('div');
        card.className = `amb-card ${isEmergency ? 'emergency' : 'normal'}`;
        card.innerHTML = `
            <div class="card-header">
                <span class="service-tag ${isEmergency ? 'tag-emer' : 'tag-norm'}">
                    ${isEmergency ? '🚨 Emergency' : 'Standard Ride'}
                </span>
                <span class="status-indicator ${statusClass}">${statusText}</span>
            </div>
            
            <div class="card-body">
                <h3>${req.service?.name || 'Ambulance'}</h3>
                <p>
                    <span class="material-symbols-rounded" style="font-size:18px;">location_on</span>
                    ${req.pickup?.lat?.toFixed(4)}, ${req.pickup?.lng?.toFixed(4)}
                </p>

                ${req.rider ? `
                  <p style="margin-top:0.75rem;color:var(--dark);font-weight:600">
                    <span class="material-symbols-rounded" style="font-size:16px;">person</span>
                    ${req.rider.name || '-'} • Age: ${req.rider.age || '-'} • Blood: ${req.rider.bloodGroup || '-'}
                  </p>
                  <p style="color:var(--gray);font-size:0.9rem;margin-top:6px">Contact: ${req.rider.emergencyContact || req.rider.mobile || '-'}</p>
                  ${req.rider.medicalHistory ? `<p style="color:#9ca3af;font-size:0.85rem;margin-top:6px">Notes: ${req.rider.medicalHistory}</p>` : ''}
                ` : ''}
            </div>

            ${req.status === 'accepted' ? `
            <div class="captain-info">
                <div class="cap-avatar">
                    <span class="material-symbols-rounded">ambulance</span>
                </div>
                <div class="cap-details">
                    <div>Captain Assigned</div>
                    <small>ID: ${req.captain}</small>
                </div>
                <button class="btn-track" onclick="openTracking('${req.id}')">
                    Track
                </button>
            </div>
            ` : `
            <div class="captain-info" style="opacity: 0.6;">
                <div class="cap-avatar">
                    <span class="material-symbols-rounded">hourglass_empty</span>
                </div>
                <div class="cap-details">
                    <div>Searching...</div>
                    <small>Connecting to fleet</small>
                </div>
            </div>
            `}
        `;
        dom.requestsList.appendChild(card);
    });
}

// =====================================================
// TRACKING LOGIC (GOOGLE MAPS)
// =====================================================
window.openTracking = function (reqId) {
    document.getElementById('modal-tracking').classList.add('active');

    waitForGoogleMaps(() => {
        if (!map) {
            map = new google.maps.Map(document.getElementById('hospital-map'), {
                center: { lat: 17.4457, lng: 78.3658 },
                zoom: 15,
                disableDefaultUI: true
            });

            marker = new google.maps.Marker({
                position: { lat: 17.4457, lng: 78.3658 },
                map: map,
                title: "Ambulance"
            });
        }

        pollTracking(reqId);
        trackInterval = setInterval(() => pollTracking(reqId), 2000);
    });
};

document.getElementById('btn-close-track').onclick = () => {
    document.getElementById('modal-tracking').classList.remove('active');
    clearInterval(trackInterval);
};

// =====================================================
// POLL TRACKING
// =====================================================
async function pollTracking(reqId) {
    try {
        const res = await fetch(`http://localhost:5000/rider/status/${reqId}`);
        const data = await res.json();

        if (data.success && data.request.captainLocation) {
            const loc = data.request.captainLocation;
            const pos = { lat: loc.lat, lng: loc.lng };

            marker.setPosition(pos);
            map.panTo(pos);
            document.getElementById('track-status').innerText = "Live Tracking Active";
            document.getElementById('track-eta').innerText = "ETA: Updating...";
        }
    } catch (e) {
        console.error(e);
    }
}

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
// START APP
// =====================================================
init();
