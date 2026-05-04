"""
Download face-api.js model weights needed for browser-based face recognition.
Run once before starting the app:  python setup_models.py
"""
import os
import sys
import urllib.request

BASE      = 'https://github.com/justadudewhohacks/face-api.js/raw/master/weights/'
MODELS_DIR = os.path.join('static', 'models')

# SSD MobileNet V1  – detects multiple faces accurately
# Face Landmark 68 Tiny – lightweight alignment
# Face Recognition Net  – 128-d descriptor vectors
FILES = [
    'ssd_mobilenetv1_model-weights_manifest.json',
    'ssd_mobilenetv1_model-shard1',
    'ssd_mobilenetv1_model-shard2',
    'face_landmark_68_tiny_model-weights_manifest.json',
    'face_landmark_68_tiny_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_recognition_model-shard2',
]


def download(filename):
    dest = os.path.join(MODELS_DIR, filename)
    if os.path.exists(dest):
        size = os.path.getsize(dest)
        print(f'  [skip]  {filename}  ({size // 1024} KB already present)')
        return
    url = BASE + filename
    print(f'  [down]  {filename} ...', end='', flush=True)
    try:
        urllib.request.urlretrieve(url, dest)
        size = os.path.getsize(dest)
        print(f'  {size // 1024} KB')
    except Exception as exc:
        print(f'  FAILED – {exc}')
        if os.path.exists(dest):
            os.remove(dest)
        raise


if __name__ == '__main__':
    os.makedirs(MODELS_DIR, exist_ok=True)
    print(f'\nDownloading face-api.js models → {MODELS_DIR}/\n')
    try:
        for f in FILES:
            download(f)
    except Exception:
        print('\n✗ Download failed. Check your internet connection and retry.\n')
        sys.exit(1)
    print('\n✓ All models downloaded. Run:  python app.py\n')
