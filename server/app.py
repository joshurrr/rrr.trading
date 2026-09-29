"""Single-owner private workspace. No broker credentials or execution endpoints."""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time
from urllib.parse import urlsplit

from flask import Flask, abort, g, jsonify, redirect, render_template, request, send_file
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash
from server.validation import validate_config

ROOT = Path(__file__).resolve().parent.parent
COOKIE = 'rrr_admin_session'
SESSION_SECONDS = 8 * 60 * 60


def connect(path):
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    return db


def initialize(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.executescript('''
            CREATE TABLE IF NOT EXISTS owner (id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL, password_hash TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, csrf TEXT NOT NULL, authenticated INTEGER NOT NULL, expires REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, config TEXT NOT NULL, created_at REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS attempts (address TEXT NOT NULL, created_at REAL NOT NULL);
            CREATE INDEX IF NOT EXISTS attempts_time ON attempts(created_at);
            CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, event TEXT NOT NULL, created_at REAL NOT NULL);
        ''')
    try:
        path.chmod(0o600)
    except OSError:
        pass


def provision(path, username, password):
    if not username.strip() or len(username) > 64:
        raise ValueError('Username must contain 1–64 characters.')
    if not 14 <= len(password) <= 256:
        raise ValueError('Use a password between 14 and 256 characters.')
    initialize(path)
    hashed = generate_password_hash(password, method='scrypt')
    with connect(path) as db:
        db.execute('INSERT INTO owner VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,password_hash=excluded.password_hash', (username.strip(), hashed))
        db.execute('DELETE FROM sessions')
        db.execute('DELETE FROM attempts')
        db.execute('INSERT INTO audit(event,created_at) VALUES (?,?)', ('Owner credentials updated; sessions revoked', time.time()))


def create_app(test_config=None):
    app = Flask(__name__, static_folder=None)
    app.config.update(
        DB_PATH=Path(os.environ.get('DATA_DIR', ROOT / '.runtime')) / 'rrr.sqlite3',
        APP_ORIGIN=os.environ.get('APP_ORIGIN', 'http://localhost:8088').rstrip('/'),
        MAX_CONTENT_LENGTH=32 * 1024,
        TESTING=False,
    )
    if test_config:
        app.config.update(test_config)
    origin = urlsplit(app.config['APP_ORIGIN'])
    if origin.scheme not in ('http', 'https') or not origin.hostname or origin.username or origin.password or origin.path or origin.query or origin.fragment:
        raise ValueError('APP_ORIGIN must be a single http(s) origin with no path.')
    if origin.scheme == 'http' and origin.hostname not in ('localhost', '127.0.0.1', '::1') and os.environ.get('ALLOW_INSECURE_HTTP') != '1':
        raise ValueError('Use HTTPS for non-loopback access. See deployment instructions.')
    secure = origin.scheme == 'https'
    db_path = Path(app.config['DB_PATH'])
    initialize(db_path)
    dummy_hash = generate_password_hash(secrets.token_urlsafe(32), method='scrypt')

    def db():
        if 'db' not in g:
            g.db = connect(db_path)
        return g.db

    def audit(event):
        db().execute('INSERT INTO audit(event,created_at) VALUES (?,?)', (event, time.time()))

    def current_session():
        token = request.cookies.get(COOKIE, '')
        if not token or len(token) > 200:
            return None
        digest = hashlib.sha256(token.encode()).hexdigest()
        return db().execute('SELECT * FROM sessions WHERE token=? AND expires>?', (digest, time.time())).fetchone()

    def new_session(authenticated):
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        lifetime = SESSION_SECONDS if authenticated else 20 * 60
        digest = hashlib.sha256(token.encode()).hexdigest()
        db().execute('DELETE FROM sessions WHERE expires<=?', (time.time(),))
        db().execute('INSERT INTO sessions VALUES (?,?,?,?)', (digest, csrf, int(authenticated), time.time() + lifetime))
        db().commit()
        return token, csrf, lifetime

    def attach_cookie(response, token, lifetime):
        response.set_cookie(COOKIE, token, max_age=lifetime, httponly=True, secure=secure, samesite='Strict', path='/')
        return response

    @app.teardown_appcontext
    def close_db(error):
        connection = g.pop('db', None)
        if connection:
            connection.close()

    @app.before_request
    def protect():
        # Do not trust forwarded headers or arbitrary Host values.
        if request.host.lower() != origin.netloc.lower():
            abort(400, 'Unexpected host.')
        g.auth = current_session()
        private = request.path.startswith('/admin') or request.path.startswith('/api/') or request.path.startswith('/private-assets/')
        if private and not (g.auth and g.auth['authenticated']):
            if request.path.startswith('/admin'):
                return redirect('/login')
            abort(401, 'Sign in to continue.')
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            if request.headers.get('Origin') != app.config['APP_ORIGIN']:
                abort(403, 'Invalid request origin.')
            supplied = request.headers.get('X-CSRF-Token') or request.form.get('csrf', '')
            if not g.auth or not secrets.compare_digest(supplied, g.auth['csrf']):
                abort(403, 'Session verification failed. Reload and try again.')

    @app.after_request
    def headers(response):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        if secure:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000'
        return response

    @app.errorhandler(HTTPException)
    def http_error(error):
        if request.path.startswith('/api/'):
            return jsonify(error=error.description), error.code
        return render_template('error.html', code=error.code, message=error.description), error.code

    @app.get('/')
    def public():
        return send_file(ROOT / 'index.html')

    @app.get('/assets/style.css')
    def shared_style():
        return send_file(ROOT / 'style.css')

    @app.get('/assets/public.css')
    def public_style():
        return send_file(ROOT / 'public.css')

    @app.get('/style.css')
    def static_site_style():
        return send_file(ROOT / 'style.css')

    @app.get('/public.css')
    def static_public_style():
        return send_file(ROOT / 'public.css')

    @app.get('/healthz')
    def health():
        return jsonify(status='ok')

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if g.auth and g.auth['authenticated']:
            return redirect('/admin/')
        owner = db().execute('SELECT * FROM owner WHERE id=1').fetchone()
        if not owner:
            return render_template('login.html', configured=False, csrf='', error=None), 503
        if request.method == 'GET':
            if g.auth:
                return render_template('login.html', configured=True, csrf=g.auth['csrf'], error=None)
            token, csrf, lifetime = new_session(False)
            response = app.make_response(render_template('login.html', configured=True, csrf=csrf, error=None))
            return attach_cookie(response, token, lifetime)
        now = time.time()
        address = hashlib.sha256((request.remote_addr or 'unknown').encode()).hexdigest()
        # Reserve an attempt transactionally before hashing: concurrent guesses cannot bypass the limit.
        db().execute('BEGIN IMMEDIATE')
        db().execute('DELETE FROM attempts WHERE created_at<?', (now - 900,))
        count = db().execute('SELECT COUNT(*) FROM attempts WHERE address=?', (address,)).fetchone()[0]
        total = db().execute('SELECT COUNT(*) FROM attempts').fetchone()[0]
        if count >= 5 or total >= 25:
            db().commit()
            return render_template('login.html', configured=True, csrf=g.auth['csrf'], error='Too many attempts. Try again in 15 minutes.'), 429
        db().execute('INSERT INTO attempts VALUES (?,?)', (address, now))
        db().commit()
        username, password = request.form.get('username', ''), request.form.get('password', '')
        correct = check_password_hash(owner['password_hash'] if username == owner['username'] else dummy_hash, password[:257])
        if not correct or username != owner['username'] or len(password) > 256:
            audit('Sign-in failed')
            db().commit()
            return render_template('login.html', configured=True, csrf=g.auth['csrf'], error='Username or password was not recognised.'), 401
        db().execute('DELETE FROM sessions WHERE token=?', (g.auth['token'],))
        db().execute('DELETE FROM attempts WHERE address=?', (address,))
        audit('Owner signed in')
        token, csrf, lifetime = new_session(True)
        return attach_cookie(redirect('/admin/'), token, lifetime)

    @app.get('/admin/')
    def admin():
        return render_template('admin.html')

    @app.get('/private-assets/<name>')
    def private_asset(name):
        if name not in {'script.js', 'channel-model.js', 'calculators.js', 'channel.css', 'admin-auth.js'}:
            abort(404)
        return send_file(ROOT / 'server' / 'static' / name)

    @app.get('/api/session')
    def session_info():
        return jsonify(csrf=g.auth['csrf'], mode='paper-preview', executionEnabled=False)

    @app.post('/api/logout')
    def logout():
        db().execute('DELETE FROM sessions WHERE token=?', (g.auth['token'],))
        audit('Owner signed out')
        db().commit()
        response = jsonify(ok=True)
        response.delete_cookie(COOKIE, path='/', secure=secure, httponly=True, samesite='Strict')
        return response

    @app.get('/api/channels')
    def channels():
        rows = db().execute('SELECT * FROM channels ORDER BY created_at').fetchall()
        return jsonify(channels=[dict(id=r['id'], name=r['name'], config=json.loads(r['config'])) for r in rows])

    @app.post('/api/channels')
    def add_channel():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or set(payload) != {'name', 'config'}:
            abort(400, 'Expected a channel name and configuration.')
        name = payload['name']
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 40 or name.strip().casefold() == 'rrr conservative' or any(ord(c) < 32 for c in name):
            abort(400, 'Choose a valid personal channel name (1–40 characters).')
        if not validate_config(payload['config']):
            abort(400, 'Invalid strategy configuration. Check inputs and risk limits.')
        db().execute('BEGIN IMMEDIATE')
        if db().execute('SELECT COUNT(*) FROM channels').fetchone()[0] >= 30:
            abort(409, 'The 30-channel limit has been reached.')
        names = db().execute('SELECT name FROM channels').fetchall()
        if any(r['name'].casefold() == name.strip().casefold() for r in names):
            abort(409, 'A channel with that name already exists.')
        record = dict(id='channel-' + secrets.token_hex(16), name=name.strip(), config=payload['config'])
        db().execute('INSERT INTO channels VALUES (?,?,?,?)', (record['id'], record['name'], json.dumps(record['config'], allow_nan=False), time.time()))
        audit('Channel saved')
        db().commit()
        return jsonify(record), 201

    @app.delete('/api/channels/<channel_id>')
    def delete_channel(channel_id):
        cursor = db().execute('DELETE FROM channels WHERE id=?', (channel_id,))
        if not cursor.rowcount:
            abort(404, 'Channel not found.')
        audit('Channel removed')
        db().commit()
        return jsonify(ok=True)

    @app.get('/api/macro')
    def macro():
        path = db_path.parent / 'macro.json'
        if not path.is_file():
            return jsonify(status='pending')
        try:
            if path.stat().st_size > 128 * 1024:
                raise ValueError()
            return jsonify(json.loads(path.read_text(encoding='utf-8-sig')))
        except (ValueError, OSError):
            abort(503, 'Analysis snapshot unavailable.')

    @app.get('/api/system')
    def system():
        events = db().execute('SELECT event,created_at FROM audit ORDER BY id DESC LIMIT 20').fetchall()
        return jsonify(accounts=[], executionEnabled=False, events=[dict(r) for r in events])

    return app


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['serve', 'set-owner'])
    parser.add_argument('--username', default='owner')
    args = parser.parse_args()
    if args.command == 'set-owner':
        password = getpass.getpass('Owner password (at least 14 characters): ')
        confirm = getpass.getpass('Confirm password: ')
        if password != confirm:
            raise SystemExit('Passwords do not match.')
        path = Path(os.environ.get('DATA_DIR', ROOT / '.runtime')) / 'rrr.sqlite3'
        provision(path, args.username, password)
        print('Owner configured. Existing sessions revoked.')
    else:
        from waitress import serve
        app = create_app()
        serve(app, host=os.environ.get('BIND_HOST', '127.0.0.1'), port=int(os.environ.get('PORT', '8088')), threads=4, max_request_body_size=32768)


if __name__ == '__main__':
    main()
