import importlib.util
from pathlib import Path
import sys
import time
import unittest

spec = importlib.util.spec_from_file_location("bounded", Path(__file__).resolve().parents[1] / "tools/face/run_with_timeout.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BoundedFaceRuntimeTests(unittest.TestCase):
    def test_full_input_and_json_output(self):
        result = module.recognize_bounded(b"a" * 200000,
            [sys.executable, "-c", "import sys,json; print(json.dumps({'length':len(sys.stdin.buffer.read())}))"], 3)
        self.assertEqual(result, {"length": 200000})

    def test_slow_process_is_terminated(self):
        started = time.monotonic()
        result = module.recognize_bounded(b"test", [sys.executable, "-c", "import time;time.sleep(10)"], .15)
        self.assertEqual(result["code"], "face-processing-timeout")
        self.assertLess(time.monotonic()-started, 3)

    def test_oversized_or_invalid_output_is_rejected(self):
        for code in ["print('x'*50000)", "print('not json')", "print('[]')"]:
            self.assertIn("error", module.recognize_bounded(b"", [sys.executable, "-c", code], 3))


if __name__ == "__main__":
    unittest.main()
