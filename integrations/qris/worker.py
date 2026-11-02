"""Nesomn-owned delivery adapter. Never use upstream worker.py/seed watcher."""
import hashlib
import hmac
import json
import os
import signal
import sqlite3
import stat
import time
from pathlib import Path
from urllib.parse import urlparse

class Spool:
    def __init__(self,path,start):
        self.db=sqlite3.connect(path)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,body TEXT NOT NULL,delivered INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0);CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY,value INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS unresolved(id TEXT PRIMARY KEY,created INTEGER NOT NULL);')
        self.db.execute('INSERT OR IGNORE INTO meta VALUES(1,?)',(start,));self.db.commit()
    def start(self):
        checkpoint=self.db.execute('SELECT value FROM meta WHERE id=1').fetchone()[0]
        return max(0,checkpoint-120)
    def unresolved_ranges(self,now):
        with self.db:
            self.db.execute('CREATE TABLE IF NOT EXISTS unresolved_review(id TEXT PRIMARY KEY,created INTEGER NOT NULL,reason TEXT NOT NULL)')
            self.db.execute("INSERT OR IGNORE INTO unresolved_review SELECT id,created,'pending_over30days' FROM unresolved WHERE created<?",(now-30*86400,))
            self.db.execute('DELETE FROM unresolved WHERE created<?',(now-30*86400,))
            rows=self.db.execute('SELECT id,created FROM unresolved ORDER BY rowid LIMIT 20').fetchall()
            # Rotate unresolved rows so one permanently pending row cannot starve others.
            for ref,created in rows:
                self.db.execute('DELETE FROM unresolved WHERE id=?',(ref,))
                self.db.execute('INSERT INTO unresolved VALUES(?,?)',(ref,created))
        return [(max(0,created-1),created+1) for _,created in rows]
    def save(self,rows,end,merchant,store):
        with self.db:
            for tx in rows:
                if str(tx.get('merchant_id'))!=merchant or str(tx.get('store_id'))!=store:continue
                ref=tx.get('id');created=tx.get('create_time');amount=tx.get('amount_idr')
                if not isinstance(ref,str) or not ref or type(created) is not int or created<=0 or type(amount) is not int or amount<=0:raise ValueError('Invalid scoped feed row')
                if tx.get('completed') is not True or type(tx.get('status')) is not int or tx['status']!=3:
                    self.db.execute('INSERT OR IGNORE INTO unresolved VALUES(?,?)',(ref,created));continue
                payload={'reference':ref,'merchantId':merchant,'storeId':store,'amountIdr':amount,'createdAt':created,'status':3,'completed':True}
                body=json.dumps(payload,separators=(',',':'),sort_keys=True)
                old=self.db.execute('SELECT body FROM events WHERE id=?',(ref,)).fetchone()
                if old and old[0]!=body:raise ValueError('Receipt changed; reconciliation required')
                self.db.execute('INSERT OR IGNORE INTO events(id,body) VALUES(?,?)',(ref,body))
                self.db.execute('DELETE FROM unresolved WHERE id=?',(ref,))
            self.db.execute('UPDATE meta SET value=max(value,?) WHERE id=1',(end,))
    def deliver(self,post,secret):
        failed=0;deadline=time.monotonic()+20
        for ref,body in self.db.execute('SELECT id,body FROM events WHERE delivered=0 ORDER BY attempts,rowid LIMIT 100').fetchall():
            if time.monotonic()>deadline:break
            stamp=str(int(time.time()));signature=hmac.new(secret.encode(),f'nesomn-qris-v1\n{stamp}\n{body}'.encode(),hashlib.sha256).hexdigest()
            with self.db:self.db.execute('UPDATE events SET attempts=attempts+1 WHERE id=?',(ref,))
            try:
                response=post(body,{'content-type':'application/json','x-qris-timestamp':stamp,'x-qris-signature':signature})
                if response.status_code!=200 or response.json().get('ok') is not True:raise RuntimeError('Receipt not acknowledged')
            except Exception:
                failed+=1
                continue
            with self.db:self.db.execute('UPDATE events SET delivered=1 WHERE id=?',(ref,))
        return failed

def run_cycle(spool,pull,post,secret):
    before=spool.deliver(post,secret)
    try:pull();ok=True
    except Exception:ok=False
    after=spool.deliver(post,secret)
    return ok and not(before or after)

def fetch_complete(service,store,merchant,start,end):
    result=service.list_recent(store,merchant_id=merchant,start_time=start,end_time=end,max_pages=100)
    if result.get('truncated') is not False:
        if end-start<=1:raise RuntimeError('Feed saturated; manual narrow backfill required')
        mid=(start+end)//2
        return fetch_complete(service,store,merchant,start,mid)+fetch_complete(service,store,merchant,mid,end)
    return result['transactions']

def main():
    import httpx
    from qrismerchantid import ShopeePayPartner
    merchant=os.environ['QRIS_MERCHANT_ID'];store=os.environ['QRIS_STORE_ID'];secret=Path(os.environ['QRIS_RECEIPT_SECRET_FILE']).read_text().strip()
    url=os.environ['QRIS_INGEST_URL'];parsed=urlparse(url)
    if len(secret)<32 or not merchant.isdigit() or not store.isdigit() or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path!='/api/billing/qris/receipts' or (parsed.scheme!='https' and not(parsed.scheme=='http' and os.environ.get('QRIS_ALLOW_PRIVATE_HTTP')=='true')):raise ValueError('Invalid worker config')
    path=Path(os.environ.get('QRIS_STATE_PATH','/data/receipts.sqlite'))
    path.parent.mkdir(parents=True,exist_ok=True)
    spool=Spool(path,int(os.environ['QRIS_BACKFILL_START']))
    with spool.db:
        spool.db.execute('CREATE TABLE IF NOT EXISTS scope(id INTEGER PRIMARY KEY,merchant TEXT NOT NULL,store TEXT NOT NULL)')
        old=spool.db.execute('SELECT merchant,store FROM scope WHERE id=1').fetchone()
        if old and old!=(merchant,store):raise ValueError('State scope changed; reconcile before cutover')
        spool.db.execute('INSERT OR IGNORE INTO scope VALUES(1,?,?)',(merchant,store))
    token_path=Path(os.environ['SHOPEE_TOKEN_FILE'])
    if token_path.stat().st_mode & (stat.S_IRWXG|stat.S_IRWXO):raise ValueError('Token file must be private mode0600')
    from health_http import start_health
    health_server=start_health(os.environ.get("QRIS_HEALTH_PORT"))
    stopping=False
    def stop(*_):
        nonlocal stopping
        stopping=True
    signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
    try:
        with httpx.Client(timeout=10,follow_redirects=False,trust_env=False) as hook:
            while not stopping:
                try:
                    def pull():
                        token=token_path.read_text().strip()
                        if not token.startswith('B:'):raise ValueError('Invalid merchant token')
                        sp=ShopeePayPartner(token=token,timeout=10,max_retries=1)
                        try:
                            if store not in {str(s['id']) for s in sp.stores.list_stores()}:raise ValueError('Store not in merchant session')
                            start=spool.start();now=int(time.time())
                            if now-start>30*86400:raise RuntimeError('Backfill exceeds30days; operator reconciliation required')
                            while start<now and not stopping:
                                end=min(now,start+3600)
                                rows=fetch_complete(sp.transactions,store,merchant,start,end)
                                spool.save(rows,end,merchant,store);start=end
                            for lo,hi in spool.unresolved_ranges(now):
                                spool.save(fetch_complete(sp.transactions,store,merchant,lo,hi),int(spool.db.execute('SELECT value FROM meta WHERE id=1').fetchone()[0]),merchant,store)
                        finally:sp.close()

                    if not run_cycle(spool,pull,lambda body,headers:hook.post(url,content=body,headers=headers),secret):raise RuntimeError('Polling or delivery incomplete')
                    Path('/tmp/qris-health').write_text(str(int(time.time())))
                except Exception:
                    # Do not log SDK exception messages/bodies, sessions, URL tokens or credentials.
                    print('QRIS polling/delivery requires retry or operator reconciliation',flush=True)
                for _ in range(10):
                    if stopping:break
                    time.sleep(1)
    finally:
        if health_server:
            health_server.shutdown()
            health_server.server_close()
        spool.db.close()

if __name__=='__main__':main()
