from __future__ import annotations

import contextlib
import os
import pathlib
import random
import socket
import subprocess
import time
import urllib.request


ROOT = pathlib.Path(__file__).resolve().parent.parent
PREVIEW_APP = ROOT / "apps" / "preview"
SAFE_PORT_RANGE = range(45000, 55000)


def reserve_port() -> int:
    candidates = list(SAFE_PORT_RANGE)
    random.shuffle(candidates)
    for port in candidates:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("Could not reserve a preview-app port in the safe local test range")


def wait_for_server(base_url: str, process: subprocess.Popen[str], timeout: float = 90.0) -> None:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        if process.poll() is not None:
            output = process.stdout.read() if process.stdout else ""
            raise RuntimeError(f"Preview app exited with code {process.returncode}.\n{output}")
        try:
            with urllib.request.urlopen(base_url, timeout=1):
                return
        except Exception as exc:  # pragma: no cover - retry loop
            last_error = exc
            time.sleep(0.25)
    raise RuntimeError(f"Preview app did not start at {base_url}: {last_error}")


@contextlib.contextmanager
def preview_app(*, extra_env: dict[str, str] | None = None, timeout: float = 90.0) -> str:
    external_base_url = os.environ.get("DG_PREVIEW_BASE_URL")
    if external_base_url:
        if extra_env:
            raise RuntimeError("DG_PREVIEW_BASE_URL cannot be combined with per-test preview env overrides")
        yield external_base_url.rstrip("/")
        return

    port = reserve_port()
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    npm_executable = "npm.cmd" if os.name == "nt" else "npm"
    process = subprocess.Popen(
        [npm_executable, "run", "start", "--", "--port", str(port)],
        cwd=str(PREVIEW_APP),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
    )
    base_url = f"http://127.0.0.1:{port}"
    try:
        wait_for_server(base_url, process, timeout=timeout)
        yield base_url
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)
