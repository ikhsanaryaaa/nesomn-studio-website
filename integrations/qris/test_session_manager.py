import base64
import copy
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import httpx
from qrismerchantid import ShopeePayPartner
from qrismerchantid.core.exceptions import ApiException
from session_manager import SessionManager, SessionUnavailable, atomic_json, read_private_json


def sample():
    merchant = {'id': '1', 'staff_user_id': 42, 'name': 'Synthetic', 'is_active': True, 'is_banned': False}
    return {'version': 1, 'token': 'B:synthetic-old', 'account_id': '42', 'merchant': merchant,
            'merchants': [merchant], 'store_id': '2', 'stores': [{'id': '2'}],
            'cookies': [{'name': 'session', 'value': 'synthetic-cookie',
                         'domain': 'partner.business.accounts.shopee.co.id', 'path': '/'}],
            'switch_credential': {'toc_nonce': 'synthetic-nonce', 'spc_clientid': 'synthetic-client',
                                  'device_fingerprint': 'synthetic-device'}}


class FakePartner:
    def __init__(self, owner, **kwargs):
        self.owner, self.token = owner, kwargs['token']
        self.auth = self
        self.closed = False
        owner.instances.append(self)
    def refresh_session(self, session):
        self.owner.refreshes += 1
        if self.owner.refresh_error:
            raise self.owner.refresh_error
        result = copy.deepcopy(session)
        result['token'] = 'B:synthetic-rotated-' + str(self.owner.refreshes)
        if self.owner.wrong_scope:
            result['merchant']['id'] = 'other'
        return result
    def set_token(self, token):
        self.token = token
    def close(self):
        self.closed = True


class TestSessionManager(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.seed = self.base / 'seed.json'
        atomic_json(self.seed, sample())
        self.now = 1700000000
        self.refreshes, self.instances = 0, []
        self.refresh_error, self.wrong_scope = None, False
        self.manager = self.make()
    def make(self):
        return SessionManager(self.seed, self.base / 'private-state', '1', '2',
                              factory=lambda **kw: FakePartner(self, **kw),
                              clock=lambda: self.now, status_path=self.base / 'status.json')
    def execute(self):
        return self.manager.run(lambda partner: partner.token)
    def test_rotates_persists_and_restart_reuses_new_session(self):
        token = self.execute()
        self.assertEqual(token, 'B:synthetic-rotated-1')
        self.assertEqual(self.refreshes, 1)
        self.assertEqual(self.make().run(lambda p: p.token), token)
        self.assertEqual(self.refreshes, 1)
        self.assertEqual(read_private_json(self.manager.path)['session']['token'], token)
        self.assertEqual(self.manager.path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.manager.root.stat().st_mode & 0o777, 0o700)
        self.assertTrue(all(p.closed for p in self.instances))
    def test_periodic_refresh_uses_own_schedule_not_cookie_expiry(self):
        seed = sample();seed['expires_at'] = 99999999999999
        atomic_json(self.seed, seed)
        self.execute()
        self.now += 1801
        self.execute()
        self.assertEqual(self.refreshes, 2)
    def test_rejected_token_refreshes_once_then_retries_operation(self):
        self.execute()
        for code, http_status in [('200020', 200), ('2010000', 200), (None, 401)]:
            before = self.refreshes
            calls = []
            def operation(partner):
                calls.append(partner.token)
                if len(calls) == 1:
                    raise ApiException('synthetic expired', code, {}, http_status)
                return partner.token
            self.assertEqual(self.manager.run(operation), 'B:synthetic-rotated-' + str(before + 1))
            self.assertEqual(len(calls), 2)
            self.assertEqual(self.refreshes, before + 1)
    def test_rotated_token_rejection_does_not_loop_refresh(self):
        def operation(_):
            raise ApiException('synthetic rejected', '200020', {}, 200)
        with self.assertRaisesRegex(SessionUnavailable, 'login_required'):
            self.manager.run(operation)
        self.assertEqual(self.refreshes, 1)
    def test_identical_seed_rewrite_does_not_reset_login_required(self):
        self.refresh_error = ApiException('dead', '48500102', {}, 200)
        with self.assertRaises(SessionUnavailable): self.execute()
        atomic_json(self.seed, sample())
        with self.assertRaisesRegex(SessionUnavailable, 'login_required'): self.execute()
        self.assertEqual(self.refreshes, 1)
    def test_dead_account_latches_login_required_without_refresh_storm(self):
        self.refresh_error = ApiException('SECRET must not leak', '48500102', {'token': 'SECRET'}, 200)
        for _ in range(3):
            with self.assertRaisesRegex(SessionUnavailable, '^login_required$'): self.execute()
        self.assertEqual(self.refreshes, 1)
        self.assertEqual(self.manager.status, 'login_required')
        self.assertEqual(json.loads((self.base/'status.json').read_text()), {'state': 'login_required'})
    def test_captcha_requires_interactive_login(self):
        self.refresh_error = ApiException('SECRET', 'captcha_required', {'data': {'captcha_required': True}}, 200)
        with self.assertRaisesRegex(SessionUnavailable, 'login_required'): self.execute()
        self.assertEqual(self.manager.status, 'login_required')
    def test_transient_refresh_failure_backoff_survives_restart(self):
        self.refresh_error = httpx.ConnectError('SECRET provider URL')
        for _ in range(2):
            with self.assertRaisesRegex(SessionUnavailable, '^backoff$'): self.execute()
        self.assertEqual(self.refreshes, 1)
        with self.assertRaises(SessionUnavailable): self.make().run(lambda p: p.token)
        self.assertEqual(self.refreshes, 1)
        self.now += 31;self.refresh_error = None
        self.execute()
        self.assertEqual(self.refreshes, 2)
    def test_wrong_seed_or_rotated_scope_cannot_be_used(self):
        self.wrong_scope = True
        called = []
        with self.assertRaises(SessionUnavailable): self.manager.run(lambda p: called.append(p.token))
        self.assertEqual(called, [])
        self.assertEqual(self.manager.status, 'login_required')
        for key, value in [('merchant', {'id': 'other'}), ('store_id', 'other')]:
            session = sample();session[key] = value
            atomic_json(self.seed, session)
            with self.assertRaises(SessionUnavailable): self.execute()
        self.assertEqual(self.refreshes, 1)
    def test_replacing_authorized_seed_unblocks_login_required(self):
        self.refresh_error = ApiException('dead', '48500102', {}, 200)
        with self.assertRaises(SessionUnavailable): self.execute()
        self.refresh_error = None
        updated = sample();updated['cookies'][0]['value'] = 'synthetic-new-login'
        atomic_json(self.seed, updated)
        self.assertEqual(self.execute(), 'B:synthetic-rotated-2')
        self.assertEqual(self.manager.status, 'ready')
    def test_bare_token_and_incomplete_session_cannot_enable_renewal(self):
        for session in [{'token': 'B:synthetic'}, {**sample(), 'switch_credential': {}}, {**sample(), 'cookies': []}]:
            atomic_json(self.seed, session)
            with self.assertRaises(SessionUnavailable): self.execute()
        self.assertEqual(self.refreshes, 0)
    def test_private_files_and_no_symlinks(self):
        self.seed.chmod(0o644)
        with self.assertRaises(SessionUnavailable): self.execute()
        self.seed.chmod(0o600)
        alias = self.base / 'alias.json'
        alias.symlink_to(self.seed)
        with self.assertRaises(OSError): read_private_json(alias)
    def test_atomic_failure_keeps_old_session_and_removes_temporary_file(self):
        before = self.seed.read_bytes()
        with patch('session_manager.os.replace', side_effect=OSError('synthetic disk failure')):
            with self.assertRaises(OSError): atomic_json(self.seed, {'token': 'B:never-published'})
        self.assertEqual(self.seed.read_bytes(), before)
        self.assertEqual(list(self.base.glob('.session-*')), [])
    def test_single_writer_lock(self):
        other = self.make()
        with self.manager.locked():
            with self.assertRaisesRegex(SessionUnavailable, 'session_busy'):
                with other.locked(): self.fail('lock was acquired twice')
    def test_receipt_delivery_continues_when_session_requires_login(self):
        from worker import Spool, run_cycle
        spool = Spool(':memory:', 900);self.addCleanup(spool.db.close)
        spool.save([{'id':'synthetic-receipt','merchant_id':'1','store_id':'2','create_time':1000,
                     'amount_idr':101,'status':3,'completed':True}],1100,'1','2')
        self.refresh_error = ApiException('dead','48500102',{},200)
        class Ack:
            status_code=200
            def json(self):return {'ok':True}
        self.assertFalse(run_cycle(spool,self.execute,lambda *_:Ack(),'s'*32))
        self.assertEqual(spool.db.execute('SELECT delivered FROM events').fetchone()[0],1)
    def test_actual_pinned_sdk_refresh_contract_is_offline_and_does_not_request_otp(self):
        # Real SDK sessions carry the previous dashboard JWT as well as account cookies.
        seed=sample()
        old_encoded=base64.urlsafe_b64encode(json.dumps({'token':'B:synthetic-old','userid':42}).encode()).decode().rstrip('=')
        seed['cookies'].append({'name':'__shopee_partner_website_x_token_live','value':'h.'+old_encoded+'.s','domain':'partner.shopee.co.id','path':'/'})
        atomic_json(self.seed,seed)
        calls = []
        def handler(request):
            calls.append(request.url.path)
            if request.url.path.endswith('/login_status'):
                return httpx.Response(200, json={'error':0,'data':{}})
            if request.url.path.endswith('/login_toc'):
                return httpx.Response(200, json={'error':0,'data':{'nonce':'synthetic-code'}})
            if request.url.host == 'partner.shopee.co.id':
                encoded=base64.urlsafe_b64encode(json.dumps({'token':'B:actual-sdk-rotated','userid':42}).encode()).decode().rstrip('=')
                return httpx.Response(200, headers={'set-cookie':'__shopee_partner_website_x_token_live=h.'+encoded+'.s; Path=/; Secure'})
            return httpx.Response(200, text='synthetic')
        manager=SessionManager(self.seed,self.base/'sdk-state','1','2',
            factory=lambda **kw: ShopeePayPartner(auth_transport=httpx.MockTransport(handler),**kw),
            clock=lambda:self.now,status_path=self.base/'sdk-status.json')
        self.assertEqual(manager.run(lambda p:p.client.payment_metadata()['token']),'B:actual-sdk-rotated')
        self.assertTrue(any(p.endswith('/login_status') for p in calls))
        self.assertFalse(any('otp' in p for p in calls))
        self.assertEqual(read_private_json(manager.path)['session']['token'],'B:actual-sdk-rotated')


if __name__ == '__main__':
    unittest.main()
