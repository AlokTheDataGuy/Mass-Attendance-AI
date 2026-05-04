'use strict';

let allRecords = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadClasses();
    loadRecords();

    document.getElementById('applyBtn') .addEventListener('click', loadRecords);
    document.getElementById('clearBtn') .addEventListener('click', clearFilters);
    document.getElementById('exportBtn').addEventListener('click', exportCSV);

    // Allow Enter key on filters
    ['classFilter','dateFilter'].forEach(id =>
        document.getElementById(id).addEventListener('keydown', e => {
            if (e.key === 'Enter') loadRecords();
        })
    );
});

async function loadClasses() {
    try {
        const classes = await fetch('/api/classes').then(r => r.json());
        const sel = document.getElementById('classFilter');
        sel.innerHTML = '<option value="">All Classes</option>';
        classes.forEach(c => {
            const o = document.createElement('option');
            o.value = c; o.textContent = c;
            sel.appendChild(o);
        });
    } catch (e) { /* ignore */ }
}

async function loadRecords() {
    const date = document.getElementById('dateFilter').value;
    const cls  = document.getElementById('classFilter').value;

    const tbody  = document.getElementById('recBody');
    const noData = document.getElementById('noData');
    const sumEl  = document.getElementById('summaryEl');

    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--text-2)">
        <span class="spin" style="font-size:18px;display:inline-block">⟳</span> Loading…
    </td></tr>`;
    noData.classList.add('hidden');

    try {
        const params = new URLSearchParams();
        if (date) params.set('date', date);
        if (cls)  params.set('class', cls);

        allRecords = await fetch('/api/attendance?' + params).then(r => r.json());

        if (!allRecords.length) {
            tbody.innerHTML = '';
            noData.classList.remove('hidden');
            sumEl.textContent = '';
            return;
        }

        // Render
        tbody.innerHTML = allRecords.map((r, i) => `
            <tr>
                <td style="color:var(--text-2);font-size:12px">${i + 1}</td>
                <td style="font-weight:600">${esc(r.name)}</td>
                <td><span class="badge badge-info">${esc(r.roll)}</span></td>
                <td><span class="badge badge-gray">${esc(r.class)}</span></td>
                <td style="font-size:13px">${fmtDate(r.date)}</td>
                <td style="font-size:13px;color:var(--text-2)">${r.time}</td>
            </tr>
        `).join('');

        const uniqueStudents = new Set(allRecords.map(r => r.roll)).size;
        const uniqueDates    = new Set(allRecords.map(r => r.date)).size;
        sumEl.textContent = `${allRecords.length} record(s) · ${uniqueStudents} student(s) · ${uniqueDates} day(s)`;

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--danger)">Failed to load records.</td></tr>`;
        showToast('Failed to load records', 'error');
    }
}

function clearFilters() {
    document.getElementById('classFilter').value = '';
    document.getElementById('dateFilter').value  = '';
    loadRecords();
}

function exportCSV() {
    if (!allRecords.length) { showToast('No records to export', 'warning'); return; }

    const hdr  = ['#','Name','Roll','Class','Date','Time'];
    const rows = allRecords.map((r, i) => [i+1, r.name, r.roll, r.class, r.date, r.time]);
    const csv  = [hdr, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = document.getElementById('dateFilter').value || 'all';
    const cls  = document.getElementById('classFilter').value || 'all';
    a.href     = url;
    a.download = `attendance_${date}_${cls}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${allRecords.length} records`, 'success');
}

/* ── Helpers ── */
function fmtDate(d) {
    if (!d) return '';
    try {
        return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
            weekday:'short', day:'numeric', month:'short', year:'numeric'
        });
    } catch (e) { return d; }
}

function esc(s) {
    return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
