import cv2
import pickle
import numpy as np
import os
import pyttsx3
import argparse
import dlib

# Initialize the text-to-speech engine
engine = pyttsx3.init()
engine.setProperty('rate', 150)  # Speed of speech
engine.setProperty('volume', 1.0)  # Volume level (0.0 to 1.0)

def speak_message(message):
    """Function to speak a message using pyttsx3."""
    print(message)  # Print the message to the console
    engine.say(message)
    engine.runAndWait()

# Start video capture
video = cv2.VideoCapture(0)

# Load Dlib's face detector
face_detect = dlib.get_frontal_face_detector()

faces_data = []
i = 0

# Replace input() with argparse
parser = argparse.ArgumentParser()
parser.add_argument('--name', required=True)
parser.add_argument('--id', required=True)
args = parser.parse_args()

name = args.name
user_id = args.id

# Check if the ID already exists
data_dir = 'data'
if os.path.exists(data_dir):
    if os.path.exists(os.path.join(data_dir, 'ids.pkl')):
        with open(os.path.join(data_dir, 'ids.pkl'), 'rb') as f:
            existing_ids = pickle.load(f)
        if user_id in existing_ids:
            speak_message(f"ID {user_id} already exists. Exiting the program.")
            exit()
else:
    os.makedirs(data_dir)

# Initialize the list for names and ids
names = []
ids = []

speak_message("Starting facial data collection. Please look at the camera.")

while True:
    # Read each frame from the video
    ret, frame = video.read()

    # Check if the frame was captured successfully
    if not ret:
        speak_message("Failed to capture frame. Exiting the program.")
        break

    # Convert the frame to grayscale
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Detect faces in the frame using Dlib
    faces = face_detect(gray)

    # Draw rectangles around detected faces and add text
    for face in faces:
        x, y, w, h = (face.left(), face.top(), face.width(), face.height())
        crop_img = frame[y:y + h, x:x + w]
        resize_img = cv2.resize(crop_img, (50, 50))

        if len(faces_data) < 100 and i % 10 == 0:
            faces_data.append(resize_img)
            names.append(name)
            ids.append(user_id)

        i += 1
        
        # Draw name above the face rectangle
        cv2.putText(frame, name, (x, y - 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        # Draw ID below the name
        cv2.putText(frame, f"ID: {user_id}", (x, y - 10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

    # Display collection status
    cv2.putText(frame, f"Faces Collected: {len(faces_data)}/100", (50, 50), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

    # Display the frame
    cv2.imshow("Frame", frame)

    # Exit the loop when 'q' key is pressed or when 100 faces are collected
    k = cv2.waitKey(1)
    if k == ord('q') or len(faces_data) == 100:
        speak_message("Facial data collection completed. Saving your data.")
        break

# Release video capture and destroy windows
video.release()
cv2.destroyAllWindows()

# Convert faces_data to numpy array and flatten each image
faces_data = np.array(faces_data)
faces_data = faces_data.reshape(len(faces_data), -1)

# Save names, IDs, and faces data
if not os.path.exists(os.path.join(data_dir, 'names.pkl')):
    with open(os.path.join(data_dir, 'names.pkl'), 'wb') as f:
        pickle.dump(names, f)
    with open(os.path.join(data_dir, 'ids.pkl'), 'wb') as f:
        pickle.dump(ids, f)
else:
    with open(os.path.join(data_dir, 'names.pkl'), 'rb') as f:
        existing_names = pickle.load(f)
    with open(os.path.join(data_dir, 'ids.pkl'), 'rb') as f:
        existing_ids = pickle.load(f)

    existing_names += names
    existing_ids += ids

    with open(os.path.join(data_dir, 'names.pkl'), 'wb') as f:
        pickle.dump(existing_names, f)
    with open(os.path.join(data_dir, 'ids.pkl'), 'wb') as f:
        pickle.dump(existing_ids, f)

# Save faces data
if not os.path.exists(os.path.join(data_dir, 'faces_data.pkl')):
    with open(os.path.join(data_dir, 'faces_data.pkl'), 'wb') as f:
        pickle.dump(faces_data, f)
else:
    with open(os.path.join(data_dir, 'faces_data.pkl'), 'rb') as f:
        existing_faces = pickle.load(f)
    existing_faces = np.append(existing_faces, faces_data, axis=0)
    with open(os.path.join(data_dir, 'faces_data.pkl'), 'wb') as f:
        pickle.dump(existing_faces, f)

speak_message("Your facial data has been saved successfully. Thank you!")