"""Isolated real-app fixture for the Communication browser check."""
import os
from pathlib import Path
import sys
import subprocess
import time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from test_security import SecurityFixture
SecurityFixture.setUpClass()
fixture=SecurityFixture()
try:
    fixture.listen_port=int(os.environ.get('COMMUNICATION_PORT','18496'))
    fixture.listen_host='0.0.0.0'
    fixture.setUp()
    fixture.sql("INSERT INTO project_client_members(project_id,email,name,created_at) VALUES('shared','waiting@example.test','Unshared client','2026-01-01')")
    fixture.sql("INSERT INTO contacts(id,project_id,name,role,email) VALUES('trade','shared','Bakker Joinery','Joiner','trade@example.test')")
    fixture.sql("INSERT INTO contacts(id,project_id,name,role,email) VALUES('painter','shared','Painter without email','Painter','')")
    print('Communication fixture ready',flush=True)
    stop=Path('/browser/stop')
    deadline=time.time()+900
    while time.time()<deadline and not stop.exists():
        if os.environ.get('COMMUNICATION_MAIL')=='1':
            subprocess.run(['php','-r','require $argv[1]; while(dispatch_comment_email()){}',str(fixture.tmp/'app/bootstrap.php')],env=fixture.env,check=True,capture_output=True)
            mail=fixture.tmp/'mail.log.messages.jsonl'
            if mail.exists():
                exported=Path('/browser/mail.jsonl');exported.write_text(mail.read_text());exported.chmod(0o600)
        time.sleep(.5)
finally:
    fixture.doCleanups()
    SecurityFixture.doClassCleanups()
