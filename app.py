from flask import Flask, render_template, request, jsonify
import sqlite3
import json
import os
from datetime import datetime

app = Flask(__name__)
DB = 'attendance.db'


def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS students (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            roll        TEXT NOT NULL UNIQUE,
            class       TEXT NOT NULL,
            descriptors TEXT NOT NULL,
            photo       TEXT DEFAULT '',
            created_at  TEXT DEFAULT (datetime('now','localtime'))
        );
        CREATE TABLE IF NOT EXISTS attendance (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            date       TEXT NOT NULL,
            time       TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES students(id),
            UNIQUE(student_id, date)
        );
    ''')
    db.commit()
    db.close()


# ── Pages ────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    db = get_db()
    total_students   = db.execute('SELECT COUNT(*) AS c FROM students').fetchone()['c']
    today            = datetime.now().strftime('%Y-%m-%d')
    today_attendance = db.execute('SELECT COUNT(*) AS c FROM attendance WHERE date=?', (today,)).fetchone()['c']
    total_days       = db.execute('SELECT COUNT(DISTINCT date) AS c FROM attendance').fetchone()['c']
    recent = db.execute('''
        SELECT s.name, s.roll, s.class, a.date, a.time
        FROM   attendance a JOIN students s ON a.student_id = s.id
        ORDER  BY a.date DESC, a.time DESC
        LIMIT  8
    ''').fetchall()
    db.close()
    return render_template('index.html',
                           page='dashboard',
                           total_students=total_students,
                           today_attendance=today_attendance,
                           total_days=total_days,
                           recent=[dict(r) for r in recent],
                           today=today)


@app.route('/register')
def register_page():
    return render_template('register.html', page='register')


@app.route('/attendance')
def attendance_page():
    return render_template('attendance.html', page='attendance')


@app.route('/records')
def records_page():
    return render_template('records.html', page='records')


# ── API: Students ─────────────────────────────────────────────────────────────

@app.route('/api/students', methods=['GET'])
def api_get_students():
    db   = get_db()
    rows = db.execute(
        'SELECT id, name, roll, class, descriptors, photo, created_at FROM students ORDER BY name'
    ).fetchall()
    db.close()
    return jsonify([{
        'id': r['id'], 'name': r['name'], 'roll': r['roll'],
        'class': r['class'], 'descriptors': json.loads(r['descriptors']),
        'photo': r['photo'], 'created_at': r['created_at']
    } for r in rows])


@app.route('/api/students', methods=['POST'])
def api_add_student():
    d    = request.json or {}
    name = (d.get('name') or '').strip()
    roll = (d.get('roll') or '').strip()
    cls  = (d.get('class') or '').strip()
    desc = d.get('descriptors', [])
    photo = d.get('photo', '')

    if not all([name, roll, cls, desc]):
        return jsonify({'success': False, 'error': 'All fields are required'}), 400

    db = get_db()
    try:
        db.execute(
            'INSERT INTO students (name, roll, class, descriptors, photo) VALUES (?,?,?,?,?)',
            (name, roll, cls, json.dumps(desc), photo)
        )
        db.commit()
        sid = db.execute('SELECT last_insert_rowid() AS id').fetchone()['id']
        return jsonify({'success': True, 'id': sid})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': f'Roll number "{roll}" is already registered'}), 409
    finally:
        db.close()


@app.route('/api/students/<int:sid>', methods=['DELETE'])
def api_delete_student(sid):
    db = get_db()
    db.execute('DELETE FROM attendance WHERE student_id=?', (sid,))
    db.execute('DELETE FROM students WHERE id=?', (sid,))
    db.commit()
    db.close()
    return jsonify({'success': True})


# ── API: Attendance ───────────────────────────────────────────────────────────

@app.route('/api/attendance', methods=['POST'])
def api_mark_attendance():
    d   = request.json or {}
    ids = d.get('student_ids', [])
    if not ids:
        return jsonify({'success': False, 'error': 'No student IDs provided'}), 400

    now    = datetime.now()
    date_s = now.strftime('%Y-%m-%d')
    time_s = now.strftime('%H:%M:%S')

    db      = get_db()
    results = []
    for sid in ids:
        s = db.execute('SELECT name, roll, class FROM students WHERE id=?', (sid,)).fetchone()
        if not s:
            continue
        exists = db.execute(
            'SELECT id FROM attendance WHERE student_id=? AND date=?', (sid, date_s)
        ).fetchone()
        if exists:
            results.append({'id': sid, 'name': s['name'], 'roll': s['roll'],
                            'class': s['class'], 'status': 'already_marked'})
        else:
            db.execute('INSERT INTO attendance (student_id, date, time) VALUES (?,?,?)',
                       (sid, date_s, time_s))
            results.append({'id': sid, 'name': s['name'], 'roll': s['roll'],
                            'class': s['class'], 'status': 'marked'})
    db.commit()
    db.close()
    return jsonify({'success': True, 'results': results, 'date': date_s, 'time': time_s})


@app.route('/api/attendance', methods=['GET'])
def api_get_attendance():
    date = request.args.get('date', '')
    cls  = request.args.get('class', '')
    q    = ('SELECT a.id, s.name, s.roll, s.class, a.date, a.time '
            'FROM attendance a JOIN students s ON a.student_id=s.id WHERE 1=1')
    p = []
    if date: q += ' AND a.date=?';    p.append(date)
    if cls:  q += ' AND s.class=?';   p.append(cls)
    q += ' ORDER BY a.date DESC, s.name ASC'
    db   = get_db()
    rows = db.execute(q, p).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/classes', methods=['GET'])
def api_get_classes():
    db   = get_db()
    rows = db.execute('SELECT DISTINCT class FROM students ORDER BY class').fetchall()
    db.close()
    return jsonify([r['class'] for r in rows])


@app.route('/api/attendance/dates', methods=['GET'])
def api_get_dates():
    cls = request.args.get('class', '')
    db  = get_db()
    if cls:
        rows = db.execute(
            'SELECT DISTINCT a.date FROM attendance a '
            'JOIN students s ON a.student_id=s.id WHERE s.class=? ORDER BY a.date DESC',
            (cls,)
        ).fetchall()
    else:
        rows = db.execute('SELECT DISTINCT date FROM attendance ORDER BY date DESC').fetchall()
    db.close()
    return jsonify([r['date'] for r in rows])


@app.route('/api/models/status', methods=['GET'])
def api_models_status():
    needed = [
        'ssd_mobilenetv1_model-weights_manifest.json',
        'face_landmark_68_tiny_model-weights_manifest.json',
        'face_recognition_model-weights_manifest.json',
    ]
    missing = [f for f in needed
               if not os.path.exists(os.path.join('static', 'models', f))]
    return jsonify({'ready': len(missing) == 0, 'missing': missing})


if __name__ == '__main__':
    for d in ['static/models', 'static/css', 'static/js', 'templates']:
        os.makedirs(d, exist_ok=True)
    init_db()
    print('\n  Face Recognition Attendance System')
    print('  → http://localhost:5000\n')
    app.run(debug=True, port=5000)
