#!/usr/bin/python3
"""Bounded host memory guard. Never restarts workloads or stops databases."""
import json
import os
import subprocess
import time
from pathlib import Path

TARGETS = [('kirokun-dev', 'kirokun-dev-api-1'), ('kirokun-proto', 'kirokun-proto-api-1')]

class Pressure:
    def __init__(self):
        self.since = None
    def update(self, available, now):
        if available >= 256:
            self.since = None
            return False
        if self.since is None:
            self.since = now
        if now - self.since >= 30:
            self.since = now
            return True
        return False

def docker(*args):
    return subprocess.check_output(['/usr/bin/docker', *args], timeout=12, text=True)

def stop_next():
    for project, name in TARGETS:
        info = json.loads(docker('inspect', name))[0]
        labels = info['Config'].get('Labels') or {}
        if labels.get('com.docker.compose.project') != project or labels.get('com.docker.compose.service') != 'api':
            raise RuntimeError('Unexpected container identity: ' + name)
        if info['State']['Running']:
            docker('stop', '--time', '5', name)
            return name
    return None

def sample():
    values = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())
    return int(values['MemAvailable'].split()[0]) // 1024

def main():
    state = Path('/var/lib/kirokun-host-guard')
    state.mkdir(exist_ok=True)
    pressure = Pressure()
    last_report = 0
    last_level = None
    while True:
        try:
            available = sample()
            now = time.monotonic()
            level = 'critical' if available < 256 else 'warning' if available < 512 else 'normal'
            status = {'time': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                      'available_mb': available, 'load': os.getloadavg(), 'level': level}
            if pressure.update(available, now):
                status['stopped_api'] = stop_next()
                incident = state / 'incidents.jsonl'
                if incident.exists() and incident.stat().st_size > 1048576:
                    incident.replace(state / 'incidents.previous.jsonl')
                with incident.open('a') as log:
                    log.write(json.dumps(status) + '\n')
                print(json.dumps(status), flush=True)
            temp = state / 'status.tmp'
            temp.write_text(json.dumps(status) + '\n')
            temp.replace(state / 'status.json')
            if now - last_report >= 60 or level != last_level:
                print(json.dumps(status), flush=True)
                last_report, last_level = now, level
        except Exception as exc:
            # A failed measurement must never trigger a workload stop.
            pressure.since = None
            print(json.dumps({'error': str(exc)}), flush=True)
        time.sleep(5)

if __name__ == '__main__':
    main()
