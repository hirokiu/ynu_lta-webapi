#!/bin/bash
set -eu
umask 077
[ "$(id -u)" = 0 ] || { echo 'Run with sudo.'; exit 1; }
report=$(mktemp /home/hiroki_u/kirokun-audit-XXXXXXXX.log)
{
echo '=== TIME / MEMORY / FAILED SERVICES ==='
date -Is; uptime; free -m; systemctl --failed --no-pager
echo '=== PREVIOUS BOOT KERNEL RESOURCE / STORAGE ERRORS ==='
journalctl -k -b -1 --no-pager --quiet | grep -Ei 'out of memory|oom|killed process|memory cgroup|I/O error|ext4.*error|hung task|blocked for more' | tail -80 || true
echo '=== CURRENT BOOT KERNEL RESOURCE / STORAGE ERRORS ==='
journalctl -k -b 0 --no-pager --quiet | grep -Ei 'out of memory|oom|killed process|memory cgroup|I/O error|ext4.*error|hung task|blocked for more' | tail -40 || true
echo '=== SSH LOG COVERAGE / ACCEPTED LOGINS / FAILURE COUNTS ==='
journalctl -u ssh --since '2026-09-17' --no-pager -o short-iso --quiet | python3 -c '
import sys,re,collections
accepted=collections.defaultdict(list); failures=collections.Counter(); count=0; first=None; last=None
for line in sys.stdin:
 count+=1; stamp=line.split(" ",1)[0]; first=first or stamp; last=stamp
 match=re.search(r"Accepted (\S+) for (\S+) from (\S+)",line)
 if match: accepted[match.groups()].append(stamp)
 if re.search(r"Failed password|Invalid user|authentication failure",line):
  ip=re.search(r"from (\S+)|rhost=(\S+)",line); failures[(next((x for x in ip.groups() if x),"unknown") if ip else "unknown")]+=1
print("journal entries:",count,"first:",first,"last:",last)
for key,times in sorted(accepted.items()): print("ACCEPTED",*key,"count",len(times),"first",times[0],"last",times[-1])
print("FAILURE lines:",sum(failures.values()),"(not unique attempts)")
for ip,total in failures.most_common(20): print("FAILED_SOURCE",ip,total)
'
echo '=== EFFECTIVE SSH SETTINGS ==='
/usr/sbin/sshd -T | grep -E '^(permitrootlogin|passwordauthentication|pubkeyauthentication|kbdinteractiveauthentication|permitemptypasswords|allowusers|allowgroups|authenticationmethods|maxauthtries) ' || true
echo '=== LISTENERS ==='
ss -lntup
echo '=== LOGIN SHELL ACCOUNTS ==='
getent passwd | awk -F: '$7 !~ /(nologin|false)$/ {print $1, $3, $6, $7}'
echo '=== AUTHORIZED KEY FINGERPRINTS ==='
for f in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do
 [ -f "$f" ] || continue
 stat -c '%U %a %y %n' "$f"
 ssh-keygen -lf "$f" | awk '{print $1, $2, $NF}'
done
echo '=== ENABLED SERVICES / TIMERS ==='
systemctl list-unit-files --state=enabled --type=service --no-pager
systemctl list-timers --all --no-pager
echo '=== CRON FILE METADATA ==='
find /etc/cron.d /var/spool/cron/crontabs -maxdepth 1 -type f -printf '%u %m %TY-%Tm-%Td %TH:%TM %p\n' 2>/dev/null || true
echo '=== FIREWALL RULES ==='
if command -v nft >/dev/null; then nft list ruleset; fi
} > "$report" 2>&1
chown hiroki_u:hiroki_u "$report"
chmod 600 "$report"
printf 'Read-only audit saved: %s\n' "$report"
