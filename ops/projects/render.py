#!/usr/bin/env python3
"""Generate a private, inactive project checkout configuration. Does not deploy."""
import argparse, json, pathlib, re, shutil
p=argparse.ArgumentParser();p.add_argument('project_id');p.add_argument('destination',type=pathlib.Path);p.add_argument('--port',type=int,required=True);a=p.parse_args()
if not re.fullmatch(r'[a-z][a-z0-9-]{2,30}',a.project_id) or a.project_id in {'proto','dev','www','admin','api','auth','mail'}:p.error('Use a unique non-reserved lowercase project ID')
if not 1024<=a.port<=65535:p.error('Port must be 1024..65535')
if a.destination.exists():p.error('Destination exists; never overwrite an existing environment')
a.destination.mkdir(parents=True,mode=0o700)
root=pathlib.Path(__file__).resolve().parents[2]
shutil.copyfile(root/'compose.yaml',a.destination/'compose.yaml')
# No production user data or credentials are copied. Each Compose project gets its own network and volume.
(a.destination/'.env.example').write_text(f'''COMPOSE_PROJECT_NAME=kirokun-{a.project_id}
ACCOUNT_SCOPE={a.project_id}
HTTP_BIND=127.0.0.1
HTTP_PORT={a.port}
RELEASE_ID=SET_VERIFIED_RELEASE
FIREBASE_PROJECT_ID=SET_FIREBASE_PROJECT
FIREBASE_WEB_CONFIG=SET_PUBLIC_WEB_CONFIG
FIREBASE_CREDENTIALS_FILE=/opt/kirokun-secrets/{a.project_id}/firebase.json
AUTH_MODE=uid
AUTH_IDENTITY_MAP={{}}
USERNAME_ACCOUNTS_ENABLED=true
ACCOUNT_INVITATIONS_ENABLED=false
ACCOUNT_PASSWORD_RESET_ENABLED=false
ACCOUNT_GOOGLE_REGISTRATION_ENABLED=false
NOTIFICATIONS_ENABLED=false
ASSIGNMENT_PREPARATION_ENABLED=false
API_MEMORY_LIMIT=256m
API_CPU_LIMIT=0.5
''')
(a.destination/'project.json').write_text(json.dumps({'projectId':a.project_id,'visibility':'private','status':'not-provisioned'},indent=2))
print('Created inactive configuration:',a.destination)
