<<<<<<< HEAD
from sklearn.neighbors import KNeighborsClassifier
import cv2
import pickle
import numpy as np
import os
import csv
import time
from datetime import datetime
import pyttsx3
import sys
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

sys.stderr = sys.stdout  # Redirect stderr to stdout for Flask

def speak_message(message):
    engine = pyttsx3.init()
    engine.setProperty('rate', 150)
    engine.setProperty('volume', 1)
    engine.say(message)
    engine.runAndWait()

# Start video capture
video = cv2.VideoCapture(0)
if not video.isOpened():
    logging.error("Error: Could not open video.")
    exit()

# Load the Haar Cascade classifier for face detection
face_detect = cv2.CascadeClassifier("haarcascade_frontalface_default.xml")

# Load the stored data
try:
    with open('data/names.pkl', 'rb') as f:
        all_names = pickle.load(f)
    with open('data/ids.pkl', 'rb') as f:
        all_ids = pickle.load(f)
    with open('data/faces_data.pkl', 'rb') as f:
        FACES = pickle.load(f)
except FileNotFoundError:
    speak_message("Data files not found. Please register faces first.")
    exit()

# Check if FACES array is empty
if len(FACES) == 0:
    speak_message("No facial data found. Please register faces first.")
    exit()

# Create a mapping from ID to Name (use first occurrence)
id_to_name = {}
for user_id, name in zip(all_ids, all_names):
    if user_id not in id_to_name:
        id_to_name[user_id] = name

# Train KNN with IDs as labels
knn = KNeighborsClassifier(n_neighbors=5)
knn.fit(FACES, all_ids)  # Use IDs for training

COL_NAMES = ["ID", "NAME", "TIME"]

speak_message("Press P to take attendance.")
speak_message("Press Q to exit.")

while True:
    ret, frame = video.read()
    if not ret:
        logging.error("Failed to capture frame. Exiting...")
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_detect.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)

    attendance = None  # Initialize attendance outside the loop

    for (x, y, w, h) in faces:
        crop_img = frame[y:y + h, x:x + w]
        resize_img = cv2.resize(crop_img, (50, 50)).flatten().reshape(1, -1)

        # Predict the ID
        person_id = knn.predict(resize_img)[0]
        person_name = id_to_name.get(person_id, "Unknown")

        ts = time.time()
        date = datetime.fromtimestamp(ts).strftime("%d-%m-%Y")
        timestamp = datetime.fromtimestamp(ts).strftime("%H-%M-%S")
        file_path = os.path.join("Attendance", f"Attendance_{date}.csv")

        cv2.putText(frame, f"{person_name} ({person_id})", (x, y - 10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

        attendance = [person_id, person_name, timestamp]

    cv2.imshow("Face Recognition", frame)

    k = cv2.waitKey(1)
    if k == ord('p') or k == ord('P'):
        if attendance is None:
            speak_message("No face detected for attendance.")
            continue

        # Ensure the directory exists
        os.makedirs("Attendance", exist_ok=True)

        file_exists = os.path.isfile(file_path)
        already_marked = False

        # Check if attendance already taken
        if file_exists:
            with open(file_path, "r", newline="") as csvfile:
                reader = csv.reader(csvfile)
                # Skip header
                next(reader, None)
                for row in reader:
                    if row[0] == str(attendance[0]):
                        already_marked = True
                        break

        if already_marked:
            speak_message(f"{attendance[1]} has already taken attendance.")
        else:
            with open(file_path, "a", newline="") as csvfile:
                writer = csv.writer(csvfile)
                if not file_exists:
                    writer.writerow(COL_NAMES)
                writer.writerow(attendance)
                speak_message(f"Attendance for {attendance[1]} is taken.")

    if k == ord('q'):
        speak_message("Exiting the program.")
        break

video.release()
=======
from sklearn.neighbors import KNeighborsClassifier
import cv2
import pickle
import numpy as np
import os
import csv
import time
from datetime import datetime
import pyttsx3
import sys
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

sys.stderr = sys.stdout  # Redirect stderr to stdout for Flask

def speak_message(message):
    engine = pyttsx3.init()
    engine.setProperty('rate', 150)
    engine.setProperty('volume', 1)
    engine.say(message)
    engine.runAndWait()

# Start video capture
video = cv2.VideoCapture(0)
if not video.isOpened():
    logging.error("Error: Could not open video.")
    exit()

# Load the Haar Cascade classifier for face detection
face_detect = cv2.CascadeClassifier("haarcascade_frontalface_default.xml")

# Load the stored data
try:
    with open('data/names.pkl', 'rb') as f:
        all_names = pickle.load(f)
    with open('data/ids.pkl', 'rb') as f:
        all_ids = pickle.load(f)
    with open('data/faces_data.pkl', 'rb') as f:
        FACES = pickle.load(f)
except FileNotFoundError:
    speak_message("Data files not found. Please register faces first.")
    exit()

# Check if FACES array is empty
if len(FACES) == 0:
    speak_message("No facial data found. Please register faces first.")
    exit()

# Create a mapping from ID to Name (use first occurrence)
id_to_name = {}
for user_id, name in zip(all_ids, all_names):
    if user_id not in id_to_name:
        id_to_name[user_id] = name

# Train KNN with IDs as labels
knn = KNeighborsClassifier(n_neighbors=5)
knn.fit(FACES, all_ids)  # Use IDs for training

COL_NAMES = ["ID", "NAME", "TIME"]

speak_message("Press P to take attendance.")
speak_message("Press Q to exit.")

while True:
    ret, frame = video.read()
    if not ret:
        logging.error("Failed to capture frame. Exiting...")
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_detect.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)

    attendance = None  # Initialize attendance outside the loop

    for (x, y, w, h) in faces:
        crop_img = frame[y:y + h, x:x + w]
        resize_img = cv2.resize(crop_img, (50, 50)).flatten().reshape(1, -1)

        # Predict the ID
        person_id = knn.predict(resize_img)[0]
        person_name = id_to_name.get(person_id, "Unknown")

        ts = time.time()
        date = datetime.fromtimestamp(ts).strftime("%d-%m-%Y")
        timestamp = datetime.fromtimestamp(ts).strftime("%H-%M-%S")
        file_path = os.path.join("Attendance", f"Attendance_{date}.csv")

        cv2.putText(frame, f"{person_name} ({person_id})", (x, y - 10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

        attendance = [person_id, person_name, timestamp]

    cv2.imshow("Face Recognition", frame)

    k = cv2.waitKey(1)
    if k == ord('p') or k == ord('P'):
        if attendance is None:
            speak_message("No face detected for attendance.")
            continue

        # Ensure the directory exists
        os.makedirs("Attendance", exist_ok=True)

        file_exists = os.path.isfile(file_path)
        already_marked = False

        # Check if attendance already taken
        if file_exists:
            with open(file_path, "r", newline="") as csvfile:
                reader = csv.reader(csvfile)
                # Skip header
                next(reader, None)
                for row in reader:
                    if row[0] == str(attendance[0]):
                        already_marked = True
                        break

        if already_marked:
            speak_message(f"{attendance[1]} has already taken attendance.")
        else:
            with open(file_path, "a", newline="") as csvfile:
                writer = csv.writer(csvfile)
                if not file_exists:
                    writer.writerow(COL_NAMES)
                writer.writerow(attendance)
                speak_message(f"Attendance for {attendance[1]} is taken.")

    if k == ord('q'):
        speak_message("Exiting the program.")
        break

video.release()
>>>>>>> c70a5d80ed9f8770b6d4f506e32112a734a81f8e
cv2.destroyAllWindows()