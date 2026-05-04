'use strict';

const MODEL_URL = '/static/models';

let video, canvas, ctx, stream;
let labeledStudents = [];   // { id, name, roll, class, floatDescs: Float32Array[] }
let detectedMap     = new Map();  // student_id → student object
let isRunning       = false;
let modelsLoaded    = false;
let detectInterval  = null;

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('startCamBtn').addEventListener('click', startCamera);
    document.getElementById('markBtn')    .addEventListener('click', markAttendance);
    document.getElementById('snapBtn')    .addEventListener('click', snapAndDetect);
    document.getElementById('stopBtn')    .addEventListener('click', stopCamera);

    document.getElementById('threshRange').addEventListener('input', function () {
        document.getElementById('threshVal').textContent = parseFloat(this.value).toFixed(2);
    });

    fetch('/api/models/status').then(r => r.json()).then(d => {
        if (!d.ready) document.getElementById('modelAlert').style.display = 'flex';
    });
});

/* ── Start ── */
async function startCamera() {
    const btn = document.getElementById('startCamBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin">⟳</span> Initialising…';

    try {
        if (!modelsLoaded) {
            setStatus('Loading AI models…');
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);
            modelsLoaded = true;
        }

        setStatus('Fetching student data…');
        const students = await fetch('/api/students').then(r => r.json());
        if (!students.length) {
            showToast('No students enrolled yet. Register students first.', 'warning');
            btn.disabled = false;
            btn.innerHTML = '🎥 Start Camera & Begin Detection';
            return;
        }

        labeledStudents = students.map(s => ({
            ...s,
            floatDescs: s.descriptors.map(d => new Float32Array(d))
        }));

        setStatus(`Loaded ${students.length} students. Starting camera…`);

        video  = document.getElementById('attVideo');
        canvas = document.getElementById('attCanvas');
        ctx    = canvas.getContext('2d');

        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = stream;
        video.style.display = 'block';
        await new Promise(res => { video.onloadedmetadata = res; });
        video.play();

        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;

        document.getElementById('attPlaceholder').style.display = 'none';
        document.getElementById('attControls').style.display = 'flex';
        document.getElementById('runningBadge').classList.remove('hidden');

        btn.style.display = 'none';
        isRunning = true;

        // Run detection every 500 ms to avoid blocking the main thread
        detectInterval = setInterval(runDetection, 500);
        setStatus(`Detecting… ${students.length} students enrolled`);

    } catch (err) {
        console.error(err);
        showToast('Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '🎥 Start Camera & Begin Detection';
    }
}

function stopCamera() {
    isRunning = false;
    clearInterval(detectInterval);
    if (stream) stream.getTracks().forEach(t => t.stop());
    document.getElementById('attVideo').style.display = 'none';
    document.getElementById('attPlaceholder').style.display = 'flex';
    document.getElementById('attControls').style.display = 'none';
    document.getElementById('runningBadge').classList.add('hidden');
    document.getElementById('startCamBtn').style.display = 'block';
    document.getElementById('startCamBtn').disabled = false;
    document.getElementById('startCamBtn').innerHTML = '🎥 Start Camera & Begin Detection';
    ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/* ── Continuous detection loop ── */
async function runDetection() {
    if (!isRunning || !video || video.paused || video.ended) return;
    const thresh = parseFloat(document.getElementById('threshRange').value) || 0.5;
    await detectAndDraw(video, thresh, true);
}

/* ── Snap mode ── */
async function snapAndDetect() {
    if (!video) return;
    clearInterval(detectInterval);   // pause live loop

    const snap = document.createElement('canvas');
    snap.width  = video.videoWidth;
    snap.height = video.videoHeight;
    snap.getContext('2d').drawImage(video, 0, 0);

    const thresh = parseFloat(document.getElementById('threshRange').value) || 0.5;
    await detectAndDraw(snap, thresh, false);

    showToast(`Snap: ${detectedMap.size} student(s) recognised`, 'info');

    // Resume loop after 3 s
    setTimeout(() => {
        if (isRunning) detectInterval = setInterval(runDetection, 500);
    }, 3000);
}

/* ── Core detection + drawing ── */
async function detectAndDraw(source, thresh, updateList) {
    try {
        const detections = await faceapi
            .detectAllFaces(source, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
            .withFaceLandmarks(true)
            .withFaceDescriptors();

        // Scale results to canvas dimensions
        const dims    = { width: canvas.width, height: canvas.height };
        const resized = faceapi.resizeResults(detections, dims);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const newDetected = new Map();

        for (const det of resized) {
            const { x, y, width, height } = det.detection.box;
            const match = findMatch(det.descriptor, thresh);

            if (match) {
                newDetected.set(match.id, match);

                // Green box
                ctx.strokeStyle = '#10b981';
                ctx.lineWidth   = 2.5;
                ctx.strokeRect(x, y, width, height);

                // Name label
                const label = match.name;
                ctx.font = 'bold 13px Inter,sans-serif';
                const lw = ctx.measureText(label).width + 18;
                ctx.fillStyle = '#10b981';
                ctx.fillRect(x - 1, y - 26, lw, 24);
                ctx.fillStyle = '#fff';
                ctx.fillText(label, x + 8, y - 8);

                // Confidence bar
                const conf = Math.max(0, 1 - match.distance / thresh);
                ctx.fillStyle = 'rgba(16,185,129,0.35)';
                ctx.fillRect(x, y + height + 2, width * conf, 4);

            } else {
                // Red box for unknown
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth   = 1.5;
                ctx.strokeRect(x, y, width, height);
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(x - 1, y - 24, 78, 22);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Inter,sans-serif';
                ctx.fillText('Unknown', x + 6, y - 7);
            }
        }

        // Face count HUD
        if (detections.length > 0) {
            ctx.fillStyle = 'rgba(0,0,0,.55)';
            ctx.fillRect(8, 8, 130, 24);
            ctx.fillStyle = '#fff';
            ctx.font = '12px Inter,sans-serif';
            ctx.fillText(`${detections.length} face(s) in frame`, 14, 24);
        }

        if (updateList) {
            detectedMap = newDetected;
            renderDetectedList();
        } else {
            // Snap mode: merge without clearing persistent map
            for (const [k,v] of newDetected) detectedMap.set(k,v);
            renderDetectedList();
        }

        document.getElementById('faceCountBadge').textContent = `${detections.length} face${detections.length!==1?'s':''}`;

    } catch (e) {
        // Silently skip frames on error
    }
}

/* ── Matching ── */
function findMatch(descriptor, thresh) {
    let best = null, bestDist = Infinity;

    for (const student of labeledStudents) {
        for (const stored of student.floatDescs) {
            const dist = faceapi.euclideanDistance(descriptor, stored);
            if (dist < bestDist) { bestDist = dist; best = student; }
        }
    }

    return (bestDist <= thresh && best)
        ? { ...best, distance: bestDist }
        : null;
}

/* ── Detected list UI ── */
function renderDetectedList() {
    const wrap    = document.getElementById('detectedList');
    const countEl = document.getElementById('detCount');
    const markBtn = document.getElementById('markBtn');

    countEl.textContent = detectedMap.size;
    markBtn.disabled    = detectedMap.size === 0;

    if (!detectedMap.size) {
        wrap.innerHTML = `<div class="empty"><div class="ei">👥</div><p>No enrolled students detected yet</p></div>`;
        return;
    }

    wrap.innerHTML = [...detectedMap.values()].map(s => `
        <div class="face-item">
            <div class="face-avatar">${s.name[0].toUpperCase()}</div>
            <div class="face-info">
                <div class="face-name">${s.name}</div>
                <div class="face-meta">Roll: ${s.roll} · ${s.class}</div>
            </div>
            <span class="badge badge-success">✓</span>
        </div>
    `).join('');
}

/* ── Mark attendance ── */
async function markAttendance() {
    if (!detectedMap.size) return;

    const btn = document.getElementById('markBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin">⟳</span> Marking…';

    try {
        const resp = await fetch('/api/attendance', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ student_ids: [...detectedMap.keys()] })
        });
        const data = await resp.json();

        if (data.success) {
            showResultModal(data);
            const markedCount = data.results.filter(r => r.status === 'marked').length;
            document.getElementById('lastMarked').textContent =
                `Last marked: ${markedCount} new at ${data.time}`;
        } else {
            showToast(data.error || 'Failed to mark attendance', 'error');
        }
    } catch (err) {
        showToast('Network error: ' + err.message, 'error');
    } finally {
        btn.disabled = detectedMap.size === 0;
        btn.innerHTML = '✅ Mark Attendance for All Detected';
    }
}

/* ── Result modal ── */
function showResultModal(data) {
    const marked  = data.results.filter(r => r.status === 'marked');
    const already = data.results.filter(r => r.status === 'already_marked');

    const rowHtml = (list, badgeClass, badgeText) => list.map(r => `
        <div class="face-item">
            <div class="face-avatar">${r.name[0]}</div>
            <div class="face-info">
                <div class="face-name">${r.name}</div>
                <div class="face-meta">Roll: ${r.roll} · ${r.class}</div>
            </div>
            <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
    `).join('');

    const html = `
    <div class="modal-bg" onclick="if(event.target===this)this.remove()">
      <div class="modal">
        <div class="modal-title">📋 Attendance Summary</div>
        <p class="text-sm text-muted mb-3">${data.date} &nbsp;·&nbsp; ${data.time}</p>

        ${marked.length ? `
          <div class="mb-3">
            <div class="font-semi text-sm mb-2" style="color:var(--success)">✅ Newly Marked (${marked.length})</div>
            ${rowHtml(marked, 'badge-success', 'Marked')}
          </div>` : ''}

        ${already.length ? `
          <div class="mb-3">
            <div class="font-semi text-sm mb-2" style="color:var(--warning)">⚠ Already Present Today (${already.length})</div>
            ${rowHtml(already, 'badge-warning', 'Duplicate')}
          </div>` : ''}

        ${!marked.length && !already.length ? '<p class="text-muted text-sm">No students processed.</p>' : ''}

        <button class="btn btn-primary w-full mt-3"
                onclick="this.closest('.modal-bg').remove()">Done</button>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
}

function setStatus(msg) {
    const el = document.getElementById('attStatus');
    if (!el) return;
    el.textContent  = msg;
    el.style.display = msg ? 'block' : 'none';
}
