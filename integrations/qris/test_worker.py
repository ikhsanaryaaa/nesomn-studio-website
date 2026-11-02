import json
import tempfile
import unittest
from worker import Spool,fetch_complete
class TestSpool(unittest.TestCase):
 def row(self,**kw):return dict(id='sample-receipt',merchant_id='1',store_id='2',create_time=1000,amount_idr=101,status=3,completed=True,**kw)
 def test_delivery_survives_restart_and_only_ack_marks_delivered(self):
  with tempfile.TemporaryDirectory() as d:
   p=d+'/state.sqlite';s=Spool(p,900);s.save([self.row()],1100,'1','2')
   class Failed:status_code=503
   self.assertEqual(s.deliver(lambda *_:Failed(),'s'*32),1)
   s.db.close();s=Spool(p,900);self.assertEqual(s.db.execute('SELECT delivered FROM events').fetchone()[0],0)
   class Ack:
    status_code=200
    def json(self):return {'ok':True}
   s.deliver(lambda *_:Ack(),'s'*32);self.assertEqual(s.db.execute('SELECT delivered FROM events').fetchone()[0],1);s.db.close()
 def test_pending_retains_lookback_until_completed(self):
  s=Spool(':memory:',900);self.addCleanup(s.db.close);row=self.row();row.update(completed=False,status=1);s.save([row],5000,'1','2');self.assertEqual(s.start(),4880)
  s.save([self.row()],5010,'1','2');self.assertEqual(s.start(),4890)
 def test_scope_and_changed_replay(self):
  s=Spool(':memory:',900);self.addCleanup(s.db.close);s.save([self.row()],1100,'other','2');self.assertEqual(s.db.execute('SELECT count(*) FROM events').fetchone()[0],0)
  s.save([self.row()],1100,'1','2');row=self.row();row['amount_idr']=102
  with self.assertRaises(ValueError):s.save([row],1200,'1','2')
 def test_pinned_sdk_normalizes_completed_whole_rupiah_and_scope(self):
  from qrismerchantid.shopee.transactions import _normalize
  raw={'transactionId':'sample','amount':'1.001','createTime':1700000000,'storeId':'2','merchantId':'1','status':3}
  result=_normalize(raw,'2','1');self.assertEqual(result['amount_idr'],1001);self.assertIs(result['completed'],True)
  self.assertIsNone(_normalize(raw,'other','1'))
  raw['status']=1;self.assertIs(_normalize(raw,'2','1')['completed'],False)
 def test_truncation_requires_complete_time_slices(self):
  class Service:
   def list_recent(self,*_,**kw):return {'truncated':kw['end_time']-kw['start_time']>1,'transactions':[]}
  self.assertEqual(fetch_complete(Service(),'2','1',100,104),[])
 def test_failed_first_does_not_block_second(self):
  s=Spool(':memory:',900);self.addCleanup(s.db.close);second=self.row();second['id']='sample-second';s.save([self.row(),second],1100,'1','2')
  class Reply:
   def __init__(self,status):self.status_code=status
   def json(self):return {'ok':True}
  s.deliver(lambda body,_:Reply(422 if json.loads(body)['reference']=='sample-receipt' else 200),'s'*32)
  self.assertEqual(s.db.execute("SELECT delivered FROM events WHERE id='sample-second'").fetchone()[0],1)
 def test_provider_outage_does_not_block_persisted_delivery(self):
  from worker import run_cycle
  s=Spool(':memory:',900);self.addCleanup(s.db.close);s.save([self.row()],1100,'1','2')
  class Reply:
   status_code=200
   def json(self):return {'ok':True}
  def failed():raise RuntimeError('provider offline')
  self.assertFalse(run_cycle(s,failed,lambda *_:Reply(),'s'*32));self.assertEqual(s.db.execute('SELECT delivered FROM events').fetchone()[0],1)
 def test_old_unresolved_enters_review_and_forward_cursor_continues(self):
  s=Spool(':memory:',900);self.addCleanup(s.db.close);row=self.row();row.update(status=1,completed=False);s.save([row],4000000,'1','2')
  self.assertEqual(s.start(),3999880);self.assertEqual(s.unresolved_ranges(4000000),[])
  self.assertEqual(s.db.execute('SELECT count(*) FROM unresolved_review').fetchone()[0],1)

class TestPrivateHealth(unittest.TestCase):
 def test_disabled_and_invalid_ports(self):
  from health_http import start_health
  self.assertIsNone(start_health(None))
  for port in ['0','80','65536','3002x','٣٠٠٢']:
   with self.assertRaises(ValueError):start_health(port)
 def test_readiness_uses_durable_delivery_heartbeat_and_redacts_errors(self):
  import socket,time,urllib.request,urllib.error
  from health_http import start_health
  with tempfile.TemporaryDirectory() as d:
   path=d+'/health'
   with socket.socket() as s:
    s.bind(('127.0.0.1',0));port=s.getsockname()[1]
   server=start_health(str(port),path)
   try:
    base='http://127.0.0.1:'+str(port)
    self.assertEqual(urllib.request.urlopen(base+'/health/live').status,200)
    with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(base+'/health/ready')
    self.assertEqual(error.exception.code,503)
    self.assertEqual(error.exception.read(),b'{"ok":false}')
    from pathlib import Path
    Path(path).write_text(str(int(time.time())))
    self.assertEqual(urllib.request.urlopen(base+'/health/ready').status,200)
    Path(path).write_text(str(int(time.time())-121))
    with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(base)
    self.assertEqual(error.exception.code,503)
    with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(base+'/receipts')
    self.assertEqual(error.exception.code,404)
   finally:server.shutdown();server.server_close()

if __name__=='__main__':unittest.main()
