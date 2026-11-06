"""Local, stdin/stdout-only face feature extraction. Never saves camera frames.

YuNet + SFace are recognition models, NOT liveness / identity-proofing models.
The trusted PHP backend performs comparison and owns every authorization decision.
"""
import base64
import json
import os
from pathlib import Path
import struct
import sys

os.environ.setdefault("OPENCV_LOG_LEVEL", "ERROR")
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent
MODEL = "sface-2021dec-yunet-2023mar-v1"


class CaptureError(ValueError):
    """Only these fixed, user-facing messages may leave the worker."""


def detect_faces(frame, detector):
    # Detect on a smaller image, but align/recognize from the original pixels.
    height, width = frame.shape[:2]
    scale = min(1.0, 640 / max(width, height))
    small = cv2.resize(frame, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA) if scale < 1 else frame
    detector.setInputSize((small.shape[1], small.shape[0]))
    _, faces = detector.detect(small)
    if faces is None and scale < 1:
        detector.setInputSize((width, height))
        _, faces = detector.detect(frame)
        return faces
    if faces is not None and scale < 1:
        faces = faces.copy()
        faces[:, :14:2] *= width / small.shape[1]
        faces[:, 1:14:2] *= height / small.shape[0]
    return faces


def check_quality(frame, face):
    x, y, w, h = map(float, face[:4])
    if min(w, h) < 90:
        raise CaptureError("Move closer to the camera so your face is clearly visible.")
    if x < 0 or y < 0 or x + w > frame.shape[1] or y + h > frame.shape[0]:
        raise CaptureError("Keep your entire face inside the camera view, including your chin and forehead.")
    crop = frame[int(y):int(y + h), int(x):int(x + w)]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    # Consistent sharpness checks across camera resolutions; never upscale.
    if max(gray.shape) > 256:
        scale = 256 / max(gray.shape)
        gray = cv2.resize(gray, (round(gray.shape[1] * scale), round(gray.shape[0] * scale)), interpolation=cv2.INTER_AREA)
    if gray.mean() < 35:
        raise CaptureError("Your face is too dark. Face a light source and try again.")
    if gray.mean() > 230:
        raise CaptureError("Your face is too bright. Move away from direct light and try again.")
    if cv2.Laplacian(gray, cv2.CV_64F).var() < 25:
        raise CaptureError("The face image is blurry. Hold still, clean the camera lens and try again.")


def jpeg_size(raw):
    # Limit decoded allocation before passing untrusted images to OpenCV.
    if not raw.startswith(b"\xff\xd8"):
        raise ValueError("Capture a JPEG image from the camera.")
    offset = 2
    while offset + 4 <= len(raw):
        if raw[offset] != 255:
            raise ValueError("The camera image is invalid.")
        while offset < len(raw) and raw[offset] == 255:
            offset += 1
        marker = raw[offset]
        offset += 1
        if marker in (0xD9, 0xDA):
            break
        length = struct.unpack(">H", raw[offset:offset + 2])[0]
        if length < 2 or offset + length > len(raw):
            break
        if marker in (0xC0, 0xC1, 0xC2):
            height, width = struct.unpack(">HH", raw[offset + 3:offset + 7])
            if not (160 <= width <= 1280 and 160 <= height <= 1280):
                raise ValueError("Use a camera image between 160 and 1280 pixels on each side.")
            return width, height
        offset += length
    raise ValueError("The camera image is incomplete or unsupported.")


def extract(encoded, detector, recognizer):
    if not isinstance(encoded, str) or len(encoded) > 1000000:
        raise ValueError("The camera image is too large.")
    raw = base64.b64decode(encoded, validate=True)
    jpeg_size(raw)
    frame = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Unable to read the camera image.")
    faces = detect_faces(frame, detector)
    if faces is None or len(faces) == 0:
        raise CaptureError("No clear face was detected. Look directly at the camera and improve the lighting.")
    if len(faces) != 1:
        raise CaptureError("More than one face was detected. Only the ticket owner should be in the camera view.")
    face = faces[0]
    check_quality(frame, face)
    vector = recognizer.feature(recognizer.alignCrop(frame, face)).flatten().astype(float)
    norm = np.linalg.norm(vector)
    if len(vector) != 128 or not np.isfinite(vector).all() or norm < 1e-8:
        raise CaptureError("The face could not be processed. Capture again.")
    return (vector / norm).tolist()


def main():
    cv2.setNumThreads(1)
    detector = cv2.FaceDetectorYN.create(str(ROOT / "models/yunet.onnx"), "", (640, 480), 0.9, 0.3, 5000)
    recognizer = cv2.FaceRecognizerSF.create(str(ROOT / "models/sface.onnx"), "")
    raw = sys.stdin.buffer.read(3100001)
    if len(raw) > 3100000:
        raise ValueError("Too many camera images.")
    request = json.loads(raw)
    if request.get("action") == "health":
        return {"ready": True, "model": MODEL}
    frames = request.get("frames")
    if not isinstance(frames, list) or len(frames) != 3:
        raise ValueError("Capture three clear face images.")
    vectors = [extract(frame, detector, recognizer) for frame in frames]
    if min(float(np.dot(a, b)) for a in vectors for b in vectors) < 0.5:
        raise CaptureError("The captures are inconsistent. Keep the same face visible and hold still while capturing.")
    return {"vectors": vectors, "model": MODEL}


if __name__ == "__main__":
    try:
        print(json.dumps({"data": main()}, allow_nan=False))
    except CaptureError as error:
        print(json.dumps({"error": str(error)}))
    except (ValueError, KeyError, TypeError, struct.error):
        print(json.dumps({"error": "Capture three clear images with one face, good lighting and no obstructions."}))
    except Exception:
        print(json.dumps({"error": "Local face recognition is unavailable. Ask the organizer to check the face model setup."}))
