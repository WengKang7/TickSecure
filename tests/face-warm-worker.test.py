"""Worker reuse and socket protocol checks; no real biometric images."""
import importlib.util
import json
from pathlib import Path
import socket
import sys
import threading
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1] / "tools/face"
sys.path.insert(0, str(ROOT))
import recognize
spec = importlib.util.spec_from_file_location("face_server", ROOT / "server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class WarmWorkerTests(unittest.TestCase):
    def test_request_protocol_handles_large_input_and_eof(self):
        a, b = socket.socketpair()
        payload = {"sample": "x" * 200000}
        def send():
            with a:
                a.sendall(json.dumps(payload).encode())
                a.shutdown(socket.SHUT_WR)
        thread = threading.Thread(target=send)
        thread.start()
        with b:
            self.assertEqual(server.read_request(b), payload)
        thread.join()

    def test_existing_models_are_reused_and_not_closed_between_requests(self):
        detector, recognizer, movement = Mock(), Mock(), Mock()
        with patch.object(recognize, "load_models") as loader:
            for _ in range(2):
                result = recognize.main({"action": "health"}, (detector, recognizer, movement))
                self.assertTrue(result["ready"])
            loader.assert_not_called()
            movement.close.assert_not_called()

    def test_request_failure_isolated_and_next_request_uses_same_models(self):
        models = object()
        with patch.object(recognize, "main", side_effect=[recognize.CaptureError("No clear face"), {"ready": True}]) as inference:
            self.assertEqual(server.response_for({}, models), {"error": "No clear face"})
            self.assertEqual(server.response_for({}, models), {"data": {"ready": True}})
            self.assertIs(inference.call_args_list[0].args[1], models)
            self.assertIs(inference.call_args_list[1].args[1], models)

    def test_cached_model_requests_keep_all_five_captures_and_three_identity_vectors(self):
        models = (Mock(), Mock(), Mock())
        vector = [1.0] + [0.0] * 127
        def capture(frame, detector, recognizer, movement, poses, qualities):
            poses.append({"yaw": 0, "roll": 0, "offset": 0})
            qualities.append(50)
            return vector.copy()
        request = {"frames": ["a", "b", "c", "d", "e"], "movements": ["center"] * 5}
        with patch.object(recognize, "extract", side_effect=capture) as extract, patch.object(recognize, "load_models") as loader:
            first = recognize.main(request, models)
            second = recognize.main(request, models)
            self.assertEqual(first, second)
            self.assertEqual(first["vectors"], [vector] * 3)
            self.assertEqual(extract.call_count, 10)
            loader.assert_not_called()
            models[2].close.assert_not_called()

    def test_supervisor_loads_once_serves_serially_and_cancels_watchdogs(self):
        models = (Mock(), Mock(), Mock())
        listener = Mock()
        connections = [Mock(), Mock()]
        for connection in connections:
            connection.__enter__ = Mock(return_value=connection)
            connection.__exit__ = Mock(return_value=False)
        listener.accept.side_effect = [(connections[0], None), (connections[1], None), StopIteration]
        with patch.object(recognize, "load_models", return_value=models) as load, \
             patch.object(server.socket, "socket", return_value=listener), \
             patch.object(server.socket, "AF_UNIX", 1, create=True), \
             patch.object(server, "read_request", return_value={}), \
             patch.object(server, "response_for", return_value={"data": {"ready": True}}), \
             patch.object(server.Path, "unlink"), patch.object(server.os, "chmod") as permissions, \
             patch.object(server.threading, "Timer") as watchdog, patch("builtins.print"):
            with self.assertRaises(StopIteration):
                server.serve()
            load.assert_called_once()
            permissions.assert_called_once_with(Path(server.SOCKET_PATH), 0o600)
            self.assertEqual(watchdog.return_value.cancel.call_count, 3)
        models[2].close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
