"""Install the exact checksum-verified compiler for CI and release builds."""
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import tarfile
import urllib.request
import zipfile

version = Path('.zig-version').read_text().strip()
metadata = json.loads(Path('.github/zig-release.json').read_text())
if version != '0.17.0' or metadata['version'] != version:
    raise SystemExit('Expected exact Zig 0.17.0 and matching archive metadata')
arch = {'x86_64': 'x86_64', 'AMD64': 'x86_64', 'arm64': 'aarch64', 'aarch64': 'aarch64'}[platform.machine()]
os_name = {'Linux': 'linux', 'Darwin': 'macos', 'Windows': 'windows'}[platform.system()]
artifact = metadata['artifacts'][f'{arch}-{os_name}']
if not artifact['tarball'].startswith('https://ziglang.org/download/0.17.0/'):
    raise SystemExit('Expected official exact-release archive URL')
directory = Path(os.environ['RUNNER_TEMP']) / 'omajot-zig'
directory.mkdir()
archive = directory / ('zig.zip' if os_name == 'windows' else 'zig.tar.xz')
with urllib.request.urlopen(artifact['tarball'], timeout=180) as response:
    archive.write_bytes(response.read())
if hashlib.sha256(archive.read_bytes()).hexdigest() != artifact['shasum']:
    raise SystemExit('Zig archive checksum mismatch')
if os_name == 'windows':
    with zipfile.ZipFile(archive) as package:
        package.extractall(directory)
else:
    with tarfile.open(archive) as package:
        package.extractall(directory, filter='data')
compiler, = directory.glob('*/zig.exe' if os_name == 'windows' else '*/zig')
if subprocess.check_output([str(compiler), 'version'], text=True).strip() != version:
    raise SystemExit('Compiler executable version mismatch')
with open(os.environ['GITHUB_PATH'], 'a') as output:
    output.write(str(compiler.parent) + '\n')
