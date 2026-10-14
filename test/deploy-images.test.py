"""Exercise deployment command ordering with fake executables; no Docker or server writes."""
import os
import pathlib
import shutil
import subprocess
import tempfile

source = pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='kirokun-deploy-test-') as folder:
    root = pathlib.Path(folder)
    (root / 'ops').mkdir()
    (root / 'bin').mkdir()
    shutil.copyfile(source / 'ops/manage.sh', root / 'ops/manage.sh')
    (root / 'ops/schedule.conf').write_text('BACKUP_RETENTION_DAYS=7\n')
    scripts = {
        'flock': '#!/bin/bash\nexit 0\n',
        'git': '#!/bin/bash\nif [[ $1 == rev-parse ]]; then echo test-commit; fi\n',
        'docker': '''#!/bin/bash
printf '%s\\n' "$*" >> "$TRACE"
if [[ "$*" == *"config --images"* ]]; then
  [[ "$CASE" == config-failure ]] && exit 1
  printf 'test-api:test\\ntest-web:test\\n'
elif [[ "$*" == "image inspect test-web:test" && "$CASE" == missing ]]; then
  exit 1
fi
exit 0
'''
    }
    for name, content in scripts.items():
        file = root / 'bin' / name
        file.write_text(content)
        file.chmod(0o755)
    for case in ['success', 'missing', 'config-failure']:
        trace = root / 'trace'
        trace.write_text('')
        env = {**os.environ, 'PATH': str(root/'bin')+':'+os.environ['PATH'], 'TRACE':str(trace), 'CASE':case}
        result = subprocess.run(['bash',str(root/'ops/manage.sh'),'deploy-images'],env=env,capture_output=True,text=True)
        commands = trace.read_text()
        assert ' build ' not in commands
        assert ' pull ' not in commands
        if case == 'success':
            assert result.returncode == 0, result.stderr
            assert 'up -d --no-build --pull never --wait --wait-timeout 180' in commands
        else:
            assert result.returncode != 0
            assert ' up ' not in commands
            assert ' stop ' not in commands
print('PASS: prebuilt-only deployment, missing-image/config failure stops before service changes.')
