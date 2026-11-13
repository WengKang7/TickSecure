"""Synthetic pose checks plus local model loading; no stored face data or tickets."""
import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('movement', Path(__file__).resolve().parents[1] / 'tools/face/movement.py')
movement = importlib.util.module_from_spec(spec)
spec.loader.exec_module(movement)


class MovementTests(unittest.TestCase):
    def sample(self, step):
        return {'offset': 0 if step == 'center' else .2 if step == 'left' else -.2,
                'yaw': 0 if step == 'center' else 22, 'roll': 0}

    def test_both_randomized_sequences(self):
        for steps in [['center','left','center','right','center'], ['center','right','center','left','center']]:
            movement.verify_sequence([self.sample(step) for step in steps], steps)

    def test_static_wrong_order_missing_return_and_excessive_angle_fail(self):
        steps = ['center','left','center','right','center']
        correct = [self.sample(step) for step in steps]
        cases = [[self.sample('center')] * 5, correct[::-1], correct[:2] + [self.sample('left')] + correct[3:],
                 [correct[0], {**correct[1], 'yaw': 65}, *correct[2:]],
                 [correct[0], {**correct[1], 'roll': 40}, *correct[2:]]]
        for samples in cases:
            with self.subTest(samples=samples), self.assertRaises(ValueError):
                movement.verify_sequence(samples, steps)

    def test_no_client_selected_arbitrary_sequence(self):
        for steps in [None, [], ['center']*5, ['center','left','center','left','center']]:
            self.assertFalse(movement.valid_sequence(steps))

    def test_nonfinite_pose_is_rejected(self):
        class Point:
            x = .5
        points = [Point() for _ in range(478)]
        points[234].x = .2; points[454].x = .8
        matrix = np.eye(4); matrix[0,2] = np.nan
        with self.assertRaises(ValueError):
            movement.pose(points, matrix)

    def test_real_mediapipe_rejects_blank_frame(self):
        detector = movement.MovementDetector()
        try:
            with self.assertRaisesRegex(ValueError, 'exactly one'):
                detector.measure(np.full((480,640,3), 127, dtype=np.uint8))
        finally:
            detector.close()


if __name__ == '__main__': unittest.main()
