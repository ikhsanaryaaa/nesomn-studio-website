"""Nesomn session renewal using the pinned SDK contract; no OTP or credential extraction."""
import copy
import hashlib
import json
import os
import stat
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path

from qrismerchantid import ShopeePayPartner
from qrismerchantid.core.exceptions import ApiException, QmidException
from qrismerchantid.shopee.constants import INVALID_TOKEN_CODES, NOT_LOGIN_CODE


class SessionUnavailable(Exception):
    """Safe exception: never carries a provider payload or credential."""


def read_private_json(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'r', encoding='utf-8') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_size > 1024 * 1024:
            raise SessionUnavailable('session_file_invalid')
        value = json.load(stream)
    if not isinstance(value, dict):
        raise SessionUnavailable('session_file_invalid')
    return value


def atomic_json(path, value):
    path = Path(path)
    descriptor, temporary = tempfile.mkstemp(prefix='.session-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            os.fchmod(stream.fileno(), 0o600)
            json.dump(value, stream, separators=(',', ':'))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def token_rejected(error):
    return isinstance(error, ApiException) and (
        str(error.code) in INVALID_TOKEN_CODES or error.http_status == 401
    )


def login_required(error):
    if isinstance(error, ApiException):
        payload = error.payload if isinstance(error.payload, dict) else {}
        data = payload.get('data')
        return (
            str(error.code) == str(NOT_LOGIN_CODE)
            or str(error.code) == 'captcha_required'
            or (isinstance(data, dict) and data.get('captcha_required') is True)
            or 'captcha' in str(payload.get('error_msg', '')).lower()
            or error.http_status == 401
        )
    return isinstance(error, (QmidException, ValueError, KeyError, SessionUnavailable))


class SessionManager:
    def __init__(self, seed, state_directory, merchant, store, refresh_seconds=1800,
                 factory=ShopeePayPartner, clock=time.time, status_path='/tmp/qris-session-status.json'):
        if not 300 <= int(refresh_seconds) <= 86400:
            raise ValueError('SHOPEE_SESSION_REFRESH_SECONDS must be 300-86400')
        self.seed = Path(seed)
        self.root = Path(state_directory)
        if not self.seed.is_absolute() or not self.root.is_absolute():
            raise ValueError('Session paths must be absolute')
        self.root.mkdir(mode=0o700, exist_ok=True)
        info = self.root.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_mode & 0o077:
            raise SessionUnavailable('session_directory_invalid')
        self.path = self.root / 'session.json'
        if self.seed.resolve() == self.path.resolve():
            raise SessionUnavailable('session_seed_must_be_separate')
        self.merchant, self.store = merchant, store
        self.interval = int(refresh_seconds)
        self.factory, self.clock = factory, clock
        self.status_path = Path(status_path)
        self.status = 'starting'

    def report(self, state):
        self.status = state
        atomic_json(self.status_path, {'state': state})

    def validate(self, session):
        if session.get('version') != 1:
            raise SessionUnavailable('session_version_invalid')
        token = session.get('token')
        if not isinstance(token, str) or not token.startswith('B:') or len(token) <= 2:
            raise SessionUnavailable('session_token_invalid')
        merchant = session.get('merchant')
        if not isinstance(merchant, dict) or merchant.get('id') != self.merchant:
            raise SessionUnavailable('session_scope_invalid')
        staff = merchant.get('staff_user_id')
        if type(staff) is not int or staff <= 0 or session.get('account_id') != str(staff):
            raise SessionUnavailable('session_scope_invalid')
        if session.get('store_id') != self.store:
            raise SessionUnavailable('session_scope_invalid')
        if not any(isinstance(s, dict) and s.get('id') == self.store for s in session.get('stores', [])):
            raise SessionUnavailable('session_scope_invalid')
        credential = session.get('switch_credential')
        if not isinstance(credential, dict) or any(
            not isinstance(credential.get(k), str) or not credential[k]
            for k in ('toc_nonce', 'spc_clientid', 'device_fingerprint')
        ):
            raise SessionUnavailable('session_renewal_credentials_missing')
        if not isinstance(session.get('cookies'), list) or not session['cookies']:
            raise SessionUnavailable('session_cookies_missing')
        for cookie in session['cookies']:
            if not isinstance(cookie, dict) or any(not isinstance(cookie.get(k), str) or not cookie[k] for k in ('name', 'value', 'domain', 'path')):
                raise SessionUnavailable('session_cookies_invalid')
        merchants = session.get('merchants')
        if not isinstance(merchants, list) or not any(
            isinstance(m, dict) and m.get('id') == self.merchant for m in merchants
        ):
            raise SessionUnavailable('session_scope_invalid')

    @contextmanager
    def locked(self):
        # Linux worker image; one refresh writer across processes sharing this directory.
        import fcntl
        descriptor = os.open(self.root / 'session.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            info = os.fstat(descriptor)
            if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077:
                raise SessionUnavailable('session_lock_invalid')
            try:
                fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise SessionUnavailable('session_busy') from None
            yield
        finally:
            os.close(descriptor)

    def save(self, state):
        atomic_json(self.path, state)

    def fail(self, state, error):
        terminal = login_required(error) or token_rejected(error)
        count = min(int(state.get('failures', 0)) + 1, 7)
        state.update(failures=count, login_required=terminal,
                     retry_at=int(self.clock()) + min(30 * 2 ** (count - 1), 1800))
        self.save(state)
        self.report('login_required' if terminal else 'backoff')
        raise SessionUnavailable(self.status) from None

    def refresh(self, partner, state):
        self.report('refreshing')
        try:
            updated = partner.auth.refresh_session(copy.deepcopy(state['session']))
            self.validate(updated)
        except Exception as error:
            self.fail(state, error)
        # Persist rotated cookies/token before any further provider requests.
        state.update(session=updated, last_refresh=int(self.clock()), failures=0,
                     retry_at=0, login_required=False)
        self.save(state)
        partner.set_token(updated['token'])

    def run(self, operation):
        try:
            with self.locked():
                seed = read_private_json(self.seed)
                self.validate(seed)
                seed_hash = hashlib.sha256(json.dumps(seed, sort_keys=True).encode()).hexdigest()
                state = read_private_json(self.path) if self.path.exists() else None
                if state is None or state.get('seed_hash') != seed_hash:
                    state = {'seed_hash': seed_hash, 'session': seed, 'last_refresh': 0,
                             'retry_at': 0, 'failures': 0, 'login_required': False}
                self.validate(state['session'])
                if state.get('login_required'):
                    self.report('login_required')
                    raise SessionUnavailable('login_required')
                if state.get('retry_at', 0) > self.clock():
                    self.report('backoff')
                    raise SessionUnavailable('backoff')
                partner = self.factory(token=state['session']['token'], timeout=10, max_retries=1)
                try:
                    refreshed = self.clock() - state.get('last_refresh', 0) >= self.interval
                    if refreshed:
                        self.refresh(partner, state)
                    try:
                        result = operation(partner)
                    except Exception as error:
                        if not token_rejected(error) or refreshed:
                            self.fail(state, error)
                        self.refresh(partner, state)
                        try:
                            result = operation(partner)
                        except Exception as retry_error:
                            self.fail(state, retry_error)
                    state.update(failures=0, retry_at=0, login_required=False)
                    self.save(state)
                    self.report('ready')
                    return result
                finally:
                    partner.close()
        except SessionUnavailable as error:
            if str(error) not in ('login_required', 'backoff'):
                self.report('busy' if str(error) == 'session_busy' else 'session_invalid')
            raise
        except Exception:
            self.report('session_invalid')
            raise SessionUnavailable('session_invalid') from None
