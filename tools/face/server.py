"""Private local socket for serialized recognition with reusable models.
No HTTP endpoint, persistent camera files, template cache, or automatic retries.
"""
import json
import os
from pathlib import Path
import socket
import threading
import time

SOCKET_PATH = "/tmp/ticksecure-face.sock"
MAX_INPUT = 5100000


def read_request(connection):
    chunks = []
    size = 0
    while True:
        chunk = connection.recv(min(65536, MAX_INPUT + 1 - size))
        if not chunk:
            break
        size += len(chunk)
        if size > MAX_INPUT:
            raise ValueError("The camera request is too large.")
        chunks.append(chunk)
    value = json.loads(b"".join(chunks))
    if not isinstance(value, dict):
        raise ValueError("Invalid face request.")
    return value


def response_for(request, models):
    import recognize
    try:
        return {"data": recognize.main(request, models)}
    except recognize.CaptureError as error:
        return {"error": str(error)}
    except (ValueError, KeyError, TypeError):
        return {"error": "Capture five clear images with one face, good lighting and no obstructions."}
    except Exception:
        return {"error": "Face processing is unavailable. Please check registration status before retrying."}


def serve():
    import recognize
    started = time.monotonic()
    # A fresh process loads models once, not once for every attendee.
    startup_watchdog = threading.Timer(120, lambda: os._exit(1))
    startup_watchdog.daemon = True
    startup_watchdog.start()
    try:
        models = recognize.load_models()
    finally:
        startup_watchdog.cancel()
    print(f"TickSecure face models ready: {time.monotonic()-started:.2f} seconds", flush=True)
    path = Path(SOCKET_PATH)
    path.unlink(missing_ok=True)
    listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    listener.bind(str(path))
    os.chmod(path, 0o600)
    listener.listen(1)
    try:
        while True:
            connection, _ = listener.accept()
            started = time.monotonic()
            # Kill a stuck native model call; the supervisor restarts cleanly.
            watchdog = threading.Timer(120, lambda: os._exit(1))
            watchdog.daemon = True
            watchdog.start()
            try:
                connection.settimeout(15)
                with connection:
                    request = read_request(connection)
                    result = response_for(request, models)
                    del request
                    connection.sendall(json.dumps(result, allow_nan=False).encode())
                    del result
            except (OSError, ValueError):
                pass
            finally:
                watchdog.cancel()
                print(f"TickSecure warm face processing: {time.monotonic()-started:.2f} seconds", flush=True)
    finally:
        listener.close()
        models[2].close()
        path.unlink(missing_ok=True)


if __name__ == "__main__":
    serve()
