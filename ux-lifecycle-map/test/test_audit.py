import copy
import importlib.util
import json
import pathlib
import unittest

HERE = pathlib.Path(__file__).resolve().parent
SCRIPT = HERE.parent / "scripts" / "lifecycle_audit.py"
spec = importlib.util.spec_from_file_location("lifecycle_audit", SCRIPT)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
BASE = json.loads((HERE / "fixtures" / "tiny.json").read_text())


class AuditTest(unittest.TestCase):
    def test_valid(self):
        rep = audit.audit_declaration(copy.deepcopy(BASE))
        self.assertEqual(rep["errors"], [])
        self.assertEqual(rep["lifecycles"], 1)
        self.assertEqual(rep["states"], 4)
        self.assertEqual(rep["entries"][0]["distance"], 1)

    def test_unreachable_state(self):
        doc = copy.deepcopy(BASE)
        doc["lifecycles"][0]["states"].append(
            {"id": "orphan", "screen": "delivery", "next": ["accepted"], "primary": "accepted"}
        )
        rep = audit.audit_declaration(doc)
        self.assertTrue(any("unreachable" in e for e in rep["errors"]))

    def test_primary_must_be_in_next(self):
        doc = copy.deepcopy(BASE)
        doc["lifecycles"][0]["states"][0]["primary"] = "accepted"
        rep = audit.audit_declaration(doc)
        self.assertTrue(any("primary accepted is not in next" in e for e in rep["errors"]))

    def test_non_terminal_needs_primary(self):
        doc = copy.deepcopy(BASE)
        del doc["lifecycles"][0]["states"][1]["primary"]
        rep = audit.audit_declaration(doc)
        self.assertTrue(any("no primary next" in e for e in rep["errors"]))

    def test_missing_entry(self):
        doc = copy.deepcopy(BASE)
        doc["lifecycles"][0]["entry"] = "elsewhere"
        rep = audit.audit_declaration(doc)
        self.assertTrue(any("unreachable from today" in w for w in rep["warnings"]))

    def test_ongoing_cycle_has_no_terminal_warning(self):
        doc = copy.deepcopy(BASE)
        doc["lifecycles"][0]["ongoing"] = True
        doc["lifecycles"][0]["states"] = [
            {"id": "a", "screen": "delivery", "next": ["b"], "primary": "b"},
            {"id": "b", "screen": "delivery", "next": ["a"], "primary": "a"},
        ]
        rep = audit.audit_declaration(doc)
        self.assertFalse(any("no terminal" in w for w in rep["warnings"]))

    def test_state_spread_warns(self):
        doc = copy.deepcopy(BASE)
        doc["lifecycles"][0]["states"][1]["screen"] = "work"
        rep = audit.audit_declaration(doc)
        self.assertTrue(any("states spread" in w for w in rep["warnings"]))


if __name__ == "__main__":
    unittest.main()
