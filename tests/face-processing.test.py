"""Synthetic image checks: no camera, database, or stored biometric records."""
import base64
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import io
import json
import sys
import cv2
import numpy as np

spec = importlib.util.spec_from_file_location("recognize", Path(__file__).resolve().parents[1] / "tools/face/recognize.py")
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class Detector:
    def __init__(self, results):
        self.results = iter(results)
        self.sizes = []

    def setInputSize(self, size):
        self.sizes.append(size)

    def detect(self, frame):
        return None, next(self.results)


class ProcessingTests(unittest.TestCase):
    def test_landmarks_and_box_scale_back_without_scaling_confidence(self):
        face = np.array([[100, 50, 100, 120, 120, 80, 180, 80, 150, 100, 130, 140, 170, 140, .98]], dtype=np.float32)
        detector = Detector([face])
        result = worker.detect_faces(np.zeros((721, 961, 3), np.uint8), detector)
        self.assertEqual(detector.sizes, [(640, 480)])
        np.testing.assert_allclose(result[:, :14:2], face[:, :14:2] * 961 / 640, rtol=1e-6)
        np.testing.assert_allclose(result[:, 1:14:2], face[:, 1:14:2] * 721 / 480, rtol=1e-6)
        self.assertEqual(result[0, 14], face[0, 14])

    def test_no_detection_retries_original_resolution(self):
        face = np.ones((1, 15), np.float32)
        detector = Detector([None, face])
        np.testing.assert_equal(worker.detect_faces(np.zeros((720, 960, 3), np.uint8), detector), face)
        self.assertEqual(detector.sizes, [(640, 480), (960, 720)])

    def test_small_input_is_not_upscaled(self):
        detector = Detector([None])
        worker.detect_faces(np.zeros((240, 320, 3), np.uint8), detector)
        self.assertEqual(detector.sizes, [(320, 240)])

    def test_quality_provides_actionable_failures(self):
        frame = np.full((480, 640, 3), 120, np.uint8)
        for face, image, message in [
            ([20, 20, 50, 100], frame, 'closer'),
            ([-5, 20, 150, 150], frame, 'entire face'),
            ([20, 20, 150, 150], frame * 0, 'too dark'),
            ([20, 20, 150, 150], np.full_like(frame, 250), 'too bright'),
            ([20, 20, 150, 150], frame, 'blurry'),
        ]:
            with self.subTest(message=message), self.assertRaisesRegex(worker.CaptureError, message):
                worker.check_quality(image, face)

    def test_textured_well_lit_crop_passes(self):
        frame = np.random.default_rng(4).integers(60, 190, (480, 640, 3), dtype=np.uint8)
        worker.check_quality(frame, [40, 40, 200, 220])

    def test_multiple_faces_are_rejected_before_recognition(self):
        _, raw = cv2.imencode('.jpg', np.full((240, 320, 3), 120, np.uint8))
        detector = Detector([np.ones((2, 15), np.float32)])
        with self.assertRaisesRegex(worker.CaptureError, 'More than one'):
            worker.extract(base64.b64encode(raw).decode(), detector, None)

    def test_real_detector_rejects_blank_image(self):
        detector = cv2.FaceDetectorYN.create(str(worker.ROOT / 'models/yunet.onnx'), '', (640, 480), .9, .3, 5000)
        _, raw = cv2.imencode('.jpg', np.full((480, 640, 3), 120, np.uint8))
        with self.assertRaisesRegex(worker.CaptureError, 'No clear face'):
            worker.extract(base64.b64encode(raw).decode(), detector, None)

    def test_invalid_images_are_rejected(self):
        with self.assertRaises(ValueError):
            worker.extract('not base64!', None, None)
        _, raw = cv2.imencode('.jpg', np.zeros((1400, 1400, 3), np.uint8))
        with self.assertRaisesRegex(ValueError, '1280'):
            worker.jpeg_size(raw.tobytes())



class FrontalSelectionTests(unittest.TestCase):
    def test_frontal_scan_selects_three_sharpest_consistent_samples(self):
        sys.path.insert(0, str(Path(worker.__file__).parent))
        import movement
        class Detector:
            def close(self):
                pass
        vectors = []
        for i in range(5):
            vector = np.zeros(128)
            vector[0] = 1
            vector[i + 1] = .01
            vectors.append((vector / np.linalg.norm(vector)).tolist())
        qualities = [30, 80, 40, 90, 60]
        def capture(frame, detector, recognizer, pose_detector, poses, scores):
            index = int(frame)
            poses.append({'yaw': 0, 'roll': 0, 'offset': 0})
            scores.append(qualities[index])
            return vectors[index]
        payload = json.dumps({'frames': list(map(str, range(5))), 'movements': ['center'] * 5}).encode()
        with patch.object(worker.sys, 'stdin', type('Input', (), {'buffer': io.BytesIO(payload)})()), \
             patch.object(worker, 'extract', side_effect=capture), \
             patch.object(movement, 'MovementDetector', return_value=Detector()):
            result = worker.main()
        self.assertEqual(result['movementCheck'], 'frontal-v1')
        self.assertEqual(result['vectors'], [vectors[3], vectors[1], vectors[4]])


if __name__ == '__main__':
    cv2.setNumThreads(1)
    unittest.main()
