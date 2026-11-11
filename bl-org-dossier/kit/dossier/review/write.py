"""Compare-and-replace a dossier under an interprocess advisory lock.

The request is a private temporary file, never command-line document content.
Only the caller supplies paths. This helper is not an HTTP endpoint.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import tempfile


def replace(request):
    path = Path(request['path']).resolve(strict=True)
    lock_root = Path(os.environ.get('XDG_RUNTIME_DIR', tempfile.gettempdir())) / f'dossier-locks-{os.getuid()}'
    lock_root.mkdir(mode=0o700, exist_ok=True)
    if lock_root.is_symlink() or lock_root.stat().st_uid != os.getuid():
        raise PermissionError('Invalid dossier lock directory')
    os.chmod(lock_root, 0o700)
    lock_path = lock_root / hashlib.sha256(os.fsencode(path)).hexdigest()
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'r+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        before = path.read_bytes()
        if before != request['before'].encode('utf-8'):
            return {'status': 'conflict'}
        mode = stat.S_IMODE(path.stat().st_mode)
        temp_fd, temp_path = tempfile.mkstemp(prefix=f'.{path.name}.', dir=path.parent)
        try:
            with os.fdopen(temp_fd, 'wb') as output:
                os.fchmod(output.fileno(), mode)
                output.write(request['after'].encode('utf-8'))
                output.flush()
                os.fsync(output.fileno())
            if path.read_bytes() != before:
                return {'status': 'conflict'}
            os.replace(temp_path, path)
            return {'status': 'saved'}
        finally:
            Path(temp_path).unlink(missing_ok=True)


if __name__ == '__main__':
    try:
        result = replace(json.loads(Path(sys.argv[1]).read_text()))
    except Exception:
        result = {'status': 'error'}
    print(json.dumps(result))
