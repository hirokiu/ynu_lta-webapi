import importlib.util
import unittest
from unittest.mock import patch
from pathlib import Path
spec = importlib.util.spec_from_file_location('guard', Path(__file__).resolve().parents[1] / 'ops/host-guard.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

class GuardTests(unittest.TestCase):
    def test_sustained_pressure_and_recovery(self):
        p = g.Pressure()
        self.assertFalse(p.update(100, 0))
        self.assertFalse(p.update(100, 29))
        self.assertTrue(p.update(100, 30))
        self.assertFalse(p.update(100, 31))
        self.assertFalse(p.update(800, 40))
        self.assertFalse(p.update(100, 60))
    def test_dev_first_and_no_database(self):
        import json
        calls = []
        def fake(*args):
            calls.append(args)
            if args[0] == 'inspect':
                return json.dumps([{'Config': {'Labels': {'com.docker.compose.project': 'kirokun-dev', 'com.docker.compose.service': 'api'}}, 'State': {'Running': True}}])
            return ''
        with patch.object(g, 'docker', fake):
            self.assertEqual(g.stop_next(), 'kirokun-dev-api-1')
        self.assertEqual(calls[-1], ('stop', '--time', '5', 'kirokun-dev-api-1'))
    def test_wrong_identity_never_stopped(self):
        with patch.object(g, 'docker', return_value='[{"Config":{"Labels":{}},"State":{"Running":true}}]') as d:
            with self.assertRaises(RuntimeError): g.stop_next()
            self.assertEqual(d.call_count, 1)

if __name__ == '__main__': unittest.main()
