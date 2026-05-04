import cv2
import face_recognition

known_face_encodings = []
known_face_names = []

person1_image = face_recognition.load_image_file("./imgs/p1.jpg")
person2_image = face_recognition.load_image_file("./imgs/p2.jpg")
person3_image = face_recognition.load_image_file("./imgs/p3.jpeg")

person1_encoding = face_recognition.face_encodings(person1_image)[0]
person2_encoding = face_recognition.face_encodings(person2_image)[0]
person3_encoding = face_recognition.face_encodings(person3_image)[0]

known_face_encodings.append(person1_encoding)
known_face_encodings.append(person2_encoding)
known_face_encodings.append(person3_encoding)

known_face_names.append("Bill Gates")
known_face_names.append("Albert Einstein")
known_face_names.append("Alok Deep")

#Initialize webcam
video_capture = cv2.VideoCapture(0)

while True:
    ret, frame = video_capture.read()
    
    face_locations = face_recognition.face_locations(frame)
    face_encodings = face_recognition.face_encodings(frame, face_locations)
    
    for(top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
        matches = face_recognition.compare_faces(known_face_encodings, face_encoding)
        name = "Unknown"
        
        if True in matches:
            first_match_index = matches.index(True)
            name = known_face_names[first_match_index]
        
        cv2.rectangle(frame, (left, top), (right, bottom), (0, 0, 255), 2)
        cv2.putText(frame, name, (left, top - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
        
    cv2.imshow("Video", frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
    
video_capture.release()
cv2.destroyAllWindows()