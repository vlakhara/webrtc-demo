import "./style.css";

// Import the functions from Firebase
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  onSnapshot,
  getDoc,
} from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDog8x99U6rnNuK_6nheZRBytV61Hy5HuM",
  authDomain: "quotes-f71ac.firebaseapp.com",
  projectId: "quotes-f71ac",
  storageBucket: "quotes-f71ac.appspot.com",
  messagingSenderId: "975468502223",
  appId: "1:975468502223:web:d15dd62239b05b66116bba",
};

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const fireStore = getFirestore(app);

// STUN Servers for WebRTC
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
let pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = new MediaStream();

const webcamVideo = document.getElementById("webcamVideo");
const remoteVideo = document.getElementById("remoteVideo");
const webcamButton = document.getElementById("webcamButton");
const callButton = document.getElementById("callButton");
const callInput = document.getElementById("callInput");
const answerButton = document.getElementById("answerButton");
const hangUpButton = document.getElementById("hangUpButton");

// Initialize webcam and add video/audio tracks to the peer connection
webcamButton.addEventListener("click", async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    webcamVideo.srcObject = localStream;

    pc.ontrack = (event) => {
      event.streams[0]
        .getTracks()
        .forEach((track) => remoteStream.addTrack(track));
    };
    remoteVideo.srcObject = remoteStream;
    callButton.disabled = false;
    answerButton.disabled = false;
  } catch (error) {
    console.error("Error accessing webcam: ", error);
  }
});

// Create a new call
callButton.addEventListener("click", async () => {
  const callDoc = doc(collection(fireStore, "calls"));
  const offerCandidates = collection(callDoc, "offerCandidates");
  const answerCandidates = collection(callDoc, "answerCandidates");

  callInput.value = callDoc.id;

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(offerCandidates, event.candidate.toJSON());
    }
  };

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };
  await addDoc(callDoc, { offer });

  onSnapshot(callDoc, (snapshot) => {
    const data = snapshot.data();
    if (data && !pc.currentRemoteDescription && data.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  onSnapshot(answerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });
});

// Answer a call
answerButton.addEventListener("click", async () => {
  const callId = callInput.value;
  const callDoc = doc(fireStore, "calls", callId);
  const answerCandidates = collection(callDoc, "answerCandidates");
  const offerCandidates = collection(callDoc, "offerCandidates");

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(answerCandidates, event.candidate.toJSON());
    }
  };

  const callData = (await getDoc(callDoc)).data();
  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    sdp: answerDescription.sdp,
    type: answerDescription.type,
  };
  await addDoc(callDoc, { answer });

  onSnapshot(offerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });
});

// Hang up the call
hangUpButton.addEventListener("click", () => {
  pc.close();
  window.location.reload(); // Reload page to reset state
});
