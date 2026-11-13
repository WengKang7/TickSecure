"""Estimated 3D pose checks, not certified liveness or measured depth.

Runs on the server from the actual JPEGs; client landmarks/flags are never trusted.
"""
import math
from pathlib import Path
import numpy as np


def valid_sequence(steps):
    return steps in (["center", "left", "center", "right", "center"],
                     ["center", "right", "center", "left", "center"])


def pose(landmarks, matrix):
    a, b = sorted([landmarks[234], landmarks[454]], key=lambda p: p.x)
    width = b.x - a.x
    if width < .08:
        raise ValueError("Move closer so your whole face is clearly visible.")
    offset = (landmarks[1].x - (a.x + b.x) / 2) / width
    matrix = np.asarray(matrix).reshape(4, 4)
    yaw = math.degrees(math.atan2(float(matrix[0, 2]), float(matrix[2, 2])))
    roll = math.degrees(math.atan2(float(matrix[1, 0]), float(matrix[0, 0])))
    if not all(math.isfinite(n) for n in (offset, yaw, roll)):
        raise ValueError("Face angle could not be measured. Try again.")
    return {"offset": offset, "yaw": yaw, "roll": roll}


def accepts(sample, step, baseline=0):
    if abs(sample["roll"]) > 20:
        return False
    if step == "center":
        return abs(sample["yaw"]) <= 12 and abs(sample["offset"]) <= .12
    # The subject's left is the right side of an unmirrored camera image.
    delta = sample["offset"] - baseline
    return 12 <= abs(sample["yaw"]) <= 40 and (delta >= .10 if step == "left" else delta <= -.10)


def verify_sequence(samples, steps):
    if not valid_sequence(steps) or len(samples) != 5:
        raise ValueError("Complete all five guided face movements.")
    baseline = samples[0]["offset"]
    for index, (sample, step) in enumerate(zip(samples, steps)):
        if not accepts(sample, step, baseline):
            instruction = "look straight ahead" if step == "center" else f"turn slightly to your {step}"
            raise ValueError(f"Movement check failed at step {index + 1}. Please {instruction} and keep your head upright. Start a new scan.")


class MovementDetector:
    def __init__(self):
        import mediapipe as mp
        from mediapipe.tasks.python import vision
        self.mp = mp
        model = Path(__file__).resolve().parents[2] / "assets/lib/mediapipe/face_landmarker.task"
        options = vision.FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(model)),
            running_mode=vision.RunningMode.IMAGE, num_faces=2,
            min_face_detection_confidence=.7, min_face_presence_confidence=.7,
            output_facial_transformation_matrixes=True)
        self.detector = vision.FaceLandmarker.create_from_options(options)

    def measure(self, bgr):
        import cv2
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        result = self.detector.detect(self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=rgb))
        if len(result.face_landmarks) != 1 or len(result.facial_transformation_matrixes) != 1:
            raise ValueError("Keep exactly one whole face visible for the movement check.")
        return pose(result.face_landmarks[0], result.facial_transformation_matrixes[0])

    def close(self):
        self.detector.close()
