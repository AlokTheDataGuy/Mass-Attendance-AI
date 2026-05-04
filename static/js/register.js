'use strict';

const MODEL_URL    = '/static/models';
const SAMPLES_NEED = 5;

let video, canvas, ctx, stream;
let capturedDesc  = [];   // Array of Float32Array → stored as plain arrays
let capturedImgs  = [];
let isCapturing   = false;
let captureTimer  = null;
let modelsLoaded  = false;

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
    buildSlots();
    loadRecentStudents();

    document.getElementById('startCamBtn').addEventListener('click', handleStart);
    document.getElementById('registerBtn').addEventListener('click', registerStudent);
    document.getElementById('manualBtn')  .addEventListener('click', manualCapture);
    document.getElementById('retakeBtn')  .addEventListener('click', resetCaptures);

    // Live readiness check on form input
    ['stuName','stuRoll','stuClass'].forEach(id =>
        document.getElementById(id).addEventListener('input', checkReadiness)
    );

    // Check model availability
    fetch('/api/models/status').then(r => r.json()).then(d => {
        if (!d.ready) document.getElementById('modelAlert').style.display = 'flex';
    });
});

/* ── Sample slot grid ── */
function buildSlots() {
    const wrap = document.getElementById('sampleSlots');
    wrap.innerHTML = '';
    for (let i = 0; i < SAMPLES_NEED; i++) {
        const s = document.createElement('div');
        s.className = 'sample-slot';
        s.id = `slot${i}`;
        s.innerHTML = `<span class="slot-num">${i + 1}</span>`;
        wrap.appendChild(s);
    }
}

/* ── Start camera ── */
async function handleStart() {
    const btn = document.getElementById('startCamBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin">⟳</span> Initialising…';

    try {
        // Load models (only once)
        if (!modelsLoaded) {
            setStatus('Loading AI models…');
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);
            modelsLoaded = true;
        }

        setStatus('Starting camera…');
        video  = document.getElementById('regVideo');
        canvas = document.getElementById('regCanvas');
        ctx    = canvas.getContext('2d');

        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });
        video.srcObject = stream;
        video.style.display = 'block';
        await new Promise(res => { video.onloadedmetadata = res; });
        video.play();

        // Match canvas to video element size for correct coordinate mapping
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;

        document.getElementById('camPlaceholder').style.display = 'none';
        document.getElementById('camGuide').style.display = 'block';
        setStatus('Centre your face in the oval…', true);

        btn.style.display = 'none';
        document.getElementById('camControls').style.display = 'flex';

        isCapturing = true;
        scheduleCapture();

    } catch (err) {
        console.error(err);
        showToast('Camera error: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '🎥 Start Camera & Begin Capture';
    }
}

/* ── Auto-capture scheduling ── */
function scheduleCapture() {
    if (!isCapturing || capturedDesc.length >= SAMPLES_NEED) return;
    captureTimer = setTimeout(tryCapture, 800);
}

async function tryCapture() {
    if (!isCapturing || capturedDesc.length >= SAMPLES_NEED || !video) return;

    try {
        const det = await faceapi
            .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks(true)
            .withFaceDescriptor();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (det) {
            const { x, y, width, height } = det.detection.box;

            // Draw detection box
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth   = 2;
            ctx.strokeRect(x, y, width, height);

            // Crop face thumbnail
            const thumb = document.createElement('canvas');
            thumb.width  = Math.round(width);
            thumb.height = Math.round(height);
            thumb.getContext('2d').drawImage(video, x, y, width, height, 0, 0, width, height);
            const imgData = thumb.toDataURL('image/jpeg', 0.8);

            capturedDesc.push(Array.from(det.descriptor));
            capturedImgs.push(imgData);

            fillSlot(capturedDesc.length - 1, imgData);
            updateProgress();

            const done = capturedDesc.length >= SAMPLES_NEED;
            setStatus(done
                ? '✓ All 5 samples captured! Fill in details and register.'
                : `Captured ${capturedDesc.length}/${SAMPLES_NEED} — stay still…`, !done);

            if (done) {
                isCapturing = false;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                checkReadiness();
                return;
            }
        } else {
            setStatus('No face detected — move into the oval', true);
        }
    } catch (e) {
        console.warn('Capture frame error:', e);
    }

    scheduleCapture();
}

async function manualCapture() {
    clearTimeout(captureTimer);
    await tryCapture();
}

/* ── Slot / progress helpers ── */
function fillSlot(idx, src) {
    const s = document.getElementById(`slot${idx}`);
    if (!s) return;
    s.classList.add('captured');
    s.innerHTML = `<img src="${src}" alt="sample ${idx+1}"><span class="slot-tick">✓</span>`;
    document.getElementById('sampleCountBadge').textContent = `${capturedDesc.length} / ${SAMPLES_NEED} samples`;
}

function updateProgress() {
    const pct = (capturedDesc.length / SAMPLES_NEED) * 100;
    document.getElementById('capProg').style.width = pct + '%';
    if (pct === 100) document.getElementById('capProg').classList.add('green');
    document.getElementById('capCount').textContent = `${capturedDesc.length}/${SAMPLES_NEED}`;
}

function setStatus(msg, show = true) {
    const el = document.getElementById('camStatus');
    el.textContent = msg;
    el.style.display = show ? 'block' : 'none';
}

function resetCaptures() {
    clearTimeout(captureTimer);
    capturedDesc = [];
    capturedImgs = [];
    buildSlots();
    document.getElementById('capProg').style.width = '0%';
    document.getElementById('capProg').classList.remove('green');
    document.getElementById('capCount').textContent = `0/${SAMPLES_NEED}`;
    document.getElementById('sampleCountBadge').textContent = `0 / ${SAMPLES_NEED} samples`;
    document.getElementById('registerBtn').disabled = true;
    document.getElementById('r2').textContent = '⬜';
    isCapturing = true;
    setStatus('Centre your face in the oval…', true);
    scheduleCapture();
}

/* ── Readiness check ── */
function checkReadiness() {
    const name = document.getElementById('stuName').value.trim();
    const roll = document.getElementById('stuRoll').value.trim();
    const cls  = document.getElementById('stuClass').value.trim();
    const formOk = name && roll && cls;
    const faceOk = capturedDesc.length >= SAMPLES_NEED;

    document.getElementById('r1').textContent = formOk ? '✅' : '⬜';
    document.getElementById('r2').textContent = faceOk ? '✅' : '⬜';
    document.getElementById('registerBtn').disabled = !(formOk && faceOk);
}

/* ── Register ── */
async function registerStudent() {
    const name = document.getElementById('stuName').value.trim();
    const roll = document.getElementById('stuRoll').value.trim();
    const cls  = document.getElementById('stuClass').value.trim();

    if (!name || !roll || !cls) { showToast('Fill in all student details', 'warning'); return; }
    if (capturedDesc.length < SAMPLES_NEED) { showToast('Capture all face samples first', 'warning'); return; }

    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin">⟳</span> Registering…';

    try {
        const resp = await fetch('/api/students', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                name, roll, class: cls,
                descriptors: capturedDesc,
                photo: capturedImgs[0] || ''
            })
        });
        const data = await resp.json();

        if (data.success) {
            showToast(`${name} registered successfully!`, 'success');
            // Reset for next student
            document.getElementById('stuName').value  = '';
            document.getElementById('stuRoll').value  = '';
            document.getElementById('stuClass').value = '';
            resetCaptures();
            loadRecentStudents();
        } else {
            showToast(data.error || 'Registration failed', 'error');
            btn.disabled = false;
            btn.innerHTML = '✅ Register Student';
        }
    } catch (err) {
        showToast('Network error: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '✅ Register Student';
    }
}

/* ── Recent students list ── */
async function loadRecentStudents() {
    const wrap = document.getElementById('recentStudents');
    try {
        const students = await fetch('/api/students').then(r => r.json());
        if (!students.length) {
            wrap.innerHTML = '<div class="text-xs text-muted text-center" style="padding:8px">No students yet.</div>';
            return;
        }
        // Show last 6 registered (sorted by name, take first 6)
        wrap.innerHTML = students.slice(-6).reverse().map(s => `
            <div class="face-item" style="margin-bottom:6px">
                <div class="face-avatar">${s.name[0].toUpperCase()}</div>
                <div class="face-info">
                    <div class="face-name">${s.name}</div>
                    <div class="face-meta">Roll: ${s.roll} · ${s.class}</div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        wrap.innerHTML = '<div class="text-xs text-muted text-center" style="padding:8px">Failed to load.</div>';
    }
}
