"""Bound face-model inference without saving camera input to disk."""
import json
from pathlib import Path
import subprocess
import sys


def recognize_bounded(payload, command=None, timeout=120):
    if len(payload) > 5100000:
        return {"error": "The camera request is too large."}
    if command is None:
        command = [sys.executable, str(Path(__file__).with_name("recognize.py"))]
    try:
        result = subprocess.run(command, input=payload, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        return {"error": "Face processing exceeded its time limit. Please try a new scan after checking registration status.",
                "code": "face-processing-timeout"}
    if len(result.stdout) > 40000:
        return {"error": "Face processing returned too much data."}
    try:
        response = json.loads(result.stdout)
    except (ValueError, UnicodeError):
        return {"error": "Face processing could not finish. Please try again or contact the organizer."}
    return response if isinstance(response, dict) else {"error": "Face processing returned invalid data."}


if __name__ == "__main__":
    import time
    started = time.monotonic()
    try:
        print(json.dumps(recognize_bounded(sys.stdin.buffer.read(5100001)), allow_nan=False))
    finally:
        print(f"TickSecure face processing duration: {time.monotonic()-started:.2f} seconds", file=sys.stderr)
