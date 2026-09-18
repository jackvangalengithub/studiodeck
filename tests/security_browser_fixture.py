"""Temporary real-HTTP fixture for test_security_browser.cjs; no real services.
Run in the PHP test image with an export directory mounted at /browser.
"""
import json
import os
from pathlib import Path
import time
from test_security import SecurityTests, digest

out=Path(os.environ.get('SECURITY_BROWSER_EXPORT','/browser'))
out.mkdir(parents=True,exist_ok=True)
SecurityTests.setUpClass()
fixture=SecurityTests()
try:
    fixture.listen_port=int(os.environ.get('SECURITY_BROWSER_PORT','18499'))
    fixture.listen_host='0.0.0.0'
    fixture.setUp()
    fixture.sql('INSERT INTO login_tokens VALUES(?,?,?)',(digest('a'*64),'editor',int(time.time())+900))
    fixture.sql('INSERT INTO login_tokens VALUES(?,?,?)',(digest('b'*64),'admin',int(time.time())+900))
    fixture.sql('INSERT INTO studio_members(studio_id,user_id,role) VALUES(?,?,?)',('studio-b','admin','member'))
    fixture.sql('INSERT INTO login_tokens VALUES(?,?,?)',(digest('c'*64),'editor',int(time.time())+900))
    fixture.sql('INSERT INTO login_tokens VALUES(?,?,?)',(digest('e'*64),'editor',int(time.time())-1))
    link,client_token=fixture.invitation()
    (out/'fixture.json').write_text(json.dumps({'base':fixture.base,'editorToken':'a'*64,'multiToken':'b'*64,'directToken':'c'*64,'expiredToken':'e'*64,'clientToken':client_token,'clientLink':link['url']}))
    deadline=time.time()+180
    while time.time()<deadline and not (out/'done').exists():
        time.sleep(.2)
finally:
    fixture.doCleanups()
    SecurityTests.doClassCleanups()
