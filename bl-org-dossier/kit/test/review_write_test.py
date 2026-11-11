"""Interprocess CAS checks using synthetic text and private temporary files."""
import importlib.util
import multiprocessing
from pathlib import Path
import tempfile
import sys
sys.dont_write_bytecode = True
import unittest

spec = importlib.util.spec_from_file_location('review_write', Path(__file__).parents[1] / 'dossier/review/write.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def compete(path, text, barrier, results):
    barrier.wait()
    results.put(module.replace({'path': path, 'before': 'original\n', 'after': text}))


class CompareAndReplaceTest(unittest.TestCase):
    def test_two_processes_cannot_overwrite_each_others_update(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'review.bl.org'
            path.write_text('original\n')
            path.chmod(0o640)
            barrier, results = multiprocessing.Barrier(2), multiprocessing.Queue()
            workers = [multiprocessing.Process(target=compete, args=(str(path), value, barrier, results))
                       for value in ['first\n', 'second\n']]
            for worker in workers:
                worker.start()
            for worker in workers:
                worker.join(10)
                self.assertEqual(worker.exitcode, 0)
            self.assertEqual(sorted(results.get(timeout=2)['status'] for _ in workers), ['conflict', 'saved'])
            self.assertIn(path.read_text(), ['first\n', 'second\n'])
            self.assertEqual(path.stat().st_mode & 0o777, 0o640)
            self.assertEqual(list(Path(directory).iterdir()), [path])

    def test_a_stale_request_preserves_the_current_file_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'review.bl.org'
            original = b'newer\r\n\xc3\xa9t\xc3\xa9\r\n'
            path.write_bytes(original)
            result = module.replace({'path': str(path), 'before': 'old', 'after': 'lost update'})
            self.assertEqual(result, {'status': 'conflict'})
            self.assertEqual(path.read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
