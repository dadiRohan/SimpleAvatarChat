// ---------------- IMPORTS ----------------
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ---------------- THREE SETUP ----------------
const container = document.getElementById("three-container");
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
);
// camera.position.set(0, 1.9, 3.9);
camera.position.set(0, 2.5, 3.2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setClearColor(0xcccccc); //A11B2
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
// controls.enabled = false; // 👈 disables ALL movement fully
controls.enableRotate = false;
controls.enableZoom = false;
// controls.enablePan = true;
controls.target.set(0, 1.6, 0);
controls.update();

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dir = new THREE.DirectionalLight(0xffffff, 1.8);
dir.position.set(5, 10, 5);
scene.add(dir);

// ---------------- LOAD AVATAR ----------------
const loader = new GLTFLoader();

let avatar, headMesh, teethMesh;
let eyeLeftMesh, eyeRightMesh;

let bodyMesh = null;
let bodyMorphs = {};
let currentBody = {};
let targetBody = {};

// morph indices
let mouthOpenIndex = -1;
let mouthSmileIndex = -1;

let eyeBlinkLeftIndex = -1;
let eyeBlinkRightIndex = -1;

const Avatar = 'avatar_male.glb';

loader.load('/models/' + Avatar, (gltf) => {
    avatar = gltf.scene;
    avatar.scale.set(1.5, 1.5, 1.5);
    avatar.position.y = 0;

    avatar.traverse((child) => {
        if (child.isMesh && child.morphTargetDictionary) {

            // --- Head Mesh ---
            if (child.name.includes("Wolf3D_Head")) {
                headMesh = child;

                const dict = headMesh.morphTargetDictionary;

                mouthOpenIndex = dict["mouthOpen"];
                mouthSmileIndex = dict["mouthSmile"];

                console.log("HEAD MORPH:");
                console.log("mouthOpen =", mouthOpenIndex);
                console.log("mouthSmile =", mouthSmileIndex);
            }

            // --- Teeth Mesh ---
            if (child.name.includes("Wolf3D_Teeth")) {
                teethMesh = child;

                const dict = teethMesh.morphTargetDictionary;

                console.log("TEETH DICT:", dict);

                // Use same names if exist
                teethMesh.morphTargetInfluences[dict["mouthOpen"]] = 0;
                teethMesh.morphTargetInfluences[dict["mouthSmile"]] = 0;
            }

            // ---- Eye Left ----
            if (child.name.includes("EyeLeft")) {
                eyeLeftMesh = child;

                const dict = eyeLeftMesh.morphTargetDictionary;

                eyeBlinkLeftIndex = dict["eyeBlinkLeft"] ?? dict["Blink"] ?? dict["eyeBlink"];

                console.log("eyeBlinkLeft =", eyeBlinkLeftIndex);
            }

            // ---- Eye Right ----
            if (child.name.includes("EyeRight")) {
                eyeRightMesh = child;

                const dict = eyeRightMesh.morphTargetDictionary;

                eyeBlinkRightIndex = dict["eyeBlinkRight"] ?? dict["Blink"] ?? dict["eyeBlink"];

                console.log("eyeBlinkRight =", eyeBlinkRightIndex);
            }

            // ---- Body / Hand Gestures ----
            if (child.name.includes("Wolf3D_Body")) {
                bodyMesh = child;
                const dict = child.morphTargetDictionary;

                console.log("BODY MORPHS:", dict);

                // store all morph names/indices
                for (const name in dict) {
                    bodyMorphs[name] = dict[name];
                    currentBody[name] = 0;
                    targetBody[name] = 0;
                }
            }
        }
    });

    scene.add(avatar);
}, undefined, (err) => {
    console.error("Avatar load error:", err);
});

// ---------------- RANDOM BODY GESTURE ----------------

let bodyTimer = 0;

function animateBody(delta) {
    if (!bodyMesh) return;

    bodyTimer += delta;

    // every 3–5 seconds change to a new random gesture
    if (bodyTimer > 3 + Math.random() * 2) {
        bodyTimer = 0;

        for (const name in targetBody) {
            targetBody[name] = Math.random() * 0.8; // 0 → 0.8 gesture
        }
    }

    // Smooth interpolation (lerp) toward target gesture
    for (const name in bodyMorphs) {
        const i = bodyMorphs[name];
        currentBody[name] += (targetBody[name] - currentBody[name]) * 0.05;
        bodyMesh.morphTargetInfluences[i] = currentBody[name];
    }
}

// ---------------- LIP SYNC ----------------
let lipTimer;
let isTalking = false;

// const visemeMap = {
//     A: 1.0,
//     E: 0.6,
//     I: 0.5,
//     O: 0.9,
//     U: 0.7,
//     default: 0.05,
// };

const visemeMap = {
    // ---------------------------
    //  VISEME GROUP 1 – AH (AA, AO, AH, AW)
    // ---------------------------
    "AA": { open: 1.00, smile: 0.10 },
    "AH": { open: 0.95, smile: 0.10 },
    "AO": { open: 0.90, smile: 0.05 },
    "AW": { open: 0.90, smile: 0.05 },

    // ---------------------------
    //  VISEME GROUP 2 – EH / E / IY (Smile vowels)
    // ---------------------------
    "AE": { open: 0.75, smile: 0.30 },
    "EH": { open: 0.65, smile: 0.35 },
    "E": { open: 0.65, smile: 0.40 },
    "IY": { open: 0.55, smile: 0.55 },
    "EE": { open: 0.55, smile: 0.55 },

    // ---------------------------
    //  VISEME GROUP 3 – OH / OO / UW (Round vowels)
    // ---------------------------
    "OW": { open: 0.75, smile: 0.02 },
    "O": { open: 0.80, smile: 0.02 },
    "UH": { open: 0.55, smile: 0.00 },
    "UW": { open: 0.40, smile: 0.00 },
    "OO": { open: 0.40, smile: 0.00 },

    // ---------------------------
    //  VISEME GROUP 4 – CLOSED LIPS (B, P, M)
    // ---------------------------
    "B": { open: 0.00, smile: 0.05 },
    "P": { open: 0.00, smile: 0.05 },
    "M": { open: 0.00, smile: 0.05 },

    // ---------------------------
    //  VISEME GROUP 5 – MID TONGUE (D, L, T, S, Z, N)
    // ---------------------------
    "D": { open: 0.30, smile: 0.10 },
    "L": { open: 0.30, smile: 0.10 },
    "T": { open: 0.28, smile: 0.10 },
    "S": { open: 0.25, smile: 0.15 },
    "Z": { open: 0.25, smile: 0.15 },
    "N": { open: 0.28, smile: 0.10 },

    // ---------------------------
    //  VISEME GROUP 6 – BACK TONGUE (K, G, NG)
    // ---------------------------
    "K": { open: 0.20, smile: 0.00 },
    "G": { open: 0.22, smile: 0.00 },
    "NG": { open: 0.18, smile: 0.00 },

    // ---------------------------
    //  VISEME GROUP 7 – TEETH ON LIP (F, V)
    // ---------------------------
    "F": { open: 0.15, smile: 0.25 },
    "V": { open: 0.15, smile: 0.25 },

    // ---------------------------
    //  VISEME GROUP 8 – “OO/WH” SHAPE (W, Q)
    // ---------------------------
    "W": { open: 0.35, smile: 0.00 },
    "Q": { open: 0.35, smile: 0.00 },

    // ---------------------------
    //  VISEME GROUP 9 – SH / CH / JH / ZH
    // ---------------------------
    "SH": { open: 0.22, smile: 0.10 },
    "CH": { open: 0.22, smile: 0.10 },
    "JH": { open: 0.22, smile: 0.10 },
    "ZH": { open: 0.22, smile: 0.10 },

    // ---------------------------
    //  VISEME GROUP 10 – TH / DH
    // ---------------------------
    "TH": { open: 0.35, smile: 0.15 },
    "DH": { open: 0.35, smile: 0.15 },

    // ---------------------------
    //  VISEME GROUP 11 – R / ER
    // ---------------------------
    "R": { open: 0.35, smile: 0.05 },
    "ER": { open: 0.35, smile: 0.05 },

    // ---------------------------
    //  VISEME GROUP 12 – Y
    // ---------------------------
    "Y": { open: 0.45, smile: 0.25 },

    // ---------------------------
    //  DEFAULT (soft idle lip movement)
    // ---------------------------
    "default": { open: 0.05, smile: 0.02 },
};


function extractPhonemes(text) {
    text = text.toUpperCase();

    const phonemes = [];

    // PRIORITY: multi-letter phonemes first
    const patterns = [
        "TH", "SH", "CH", "OO", "EE"
    ];

    let i = 0;
    while (i < text.length) {

        // check 2-letter phonemes first
        let pair = text.substring(i, i + 2);
        if (patterns.includes(pair)) {
            phonemes.push(pair);
            i += 2;
            continue;
        }

        // fallback to single letter
        let ch = text[i];
        if (/[A-Z]/.test(ch)) {
            phonemes.push(ch);
        }

        i++;
    }

    return phonemes;
}


function setMorph(mesh, index, value) {
    if (!mesh || index < 0) return;
    mesh.morphTargetInfluences[index] = value;
}

function startLipSync(text) {
    if (!headMesh) return;

    clearInterval(lipTimer);
    isTalking = true;

    const ph = extractPhonemes(text);
    let i = 0;

    lipTimer = setInterval(() => {
        if (!isTalking) return;

        const key = ph[i] || "default";
        const data = visemeMap[key] || visemeMap.default;

        const open = data.open;
        const smile = data.smile;

        // head movement
        setMorph(headMesh, mouthOpenIndex, open);
        setMorph(headMesh, mouthSmileIndex, smile);

        // teeth follow
        if (teethMesh) {
            if ("mouthOpen" in teethMesh.morphTargetDictionary)
                setMorph(teethMesh, teethMesh.morphTargetDictionary["mouthOpen"], open);

            if ("mouthSmile" in teethMesh.morphTargetDictionary)
                setMorph(teethMesh, teethMesh.morphTargetDictionary["mouthSmile"], smile);
        }

        i++;
        if (i >= ph.length) i = 0;

    }, 85); // faster = better realism
}

// function startLipSync(text) {
//     if (!headMesh) return;

//     clearInterval(lipTimer);
//     isTalking = true;

//     const letters = text.toUpperCase().split("");
//     let i = 0;

//     lipTimer = setInterval(() => {
//         if (!isTalking) return;

//         const ch = letters[i] || "default";
//         const amount = visemeMap[ch] || visemeMap.default;

//         const v = visemeMap[ch] || visemeMap.default;

//         // head
//         setMorph(headMesh, mouthOpenIndex, v.open);
//         setMorph(headMesh, mouthSmileIndex, v.smile);

//         // teeth
//         if (teethMesh?.morphTargetDictionary["mouthOpen"] !== undefined) {
//             setMorph(teethMesh, teethMesh.morphTargetDictionary["mouthOpen"], amount);
//         }
//         if (teethMesh?.morphTargetDictionary["mouthSmile"] !== undefined) {
//             setMorph(teethMesh, teethMesh.morphTargetDictionary["mouthSmile"], amount * 0.2);
//         }

//         i++;
//         if (i >= letters.length) i = 0;

//     }, 100);
// }

function stopLipSync() {
    isTalking = false;
    clearInterval(lipTimer);

    setMorph(headMesh, mouthOpenIndex, 0);
    setMorph(headMesh, mouthSmileIndex, 0);

    if (teethMesh) {
        if ("mouthOpen" in teethMesh.morphTargetDictionary)
            setMorph(teethMesh, teethMesh.morphTargetDictionary["mouthOpen"], v.open);

        if ("mouthSmile" in teethMesh.morphTargetDictionary)
            setMorph(teethMesh, teethMesh.morphTargetDictionary["mouthSmile"], v.smile);
    }
}

// ---------------- BLINKING ----------------

let blinkCooldown = 0;

function handleBlink(delta) {
    blinkCooldown += delta;

    // blink every 2–4 seconds randomly
    if (blinkCooldown > 2 + Math.random() * 2) {
        blinkCooldown = 0;

        if (!eyeLeftMesh || !eyeRightMesh) return;

        // CLOSE EYES
        eyeLeftMesh.visible = false;
        eyeRightMesh.visible = false;

        // reopen after short delay
        setTimeout(() => {
            eyeLeftMesh.visible = true;
            eyeRightMesh.visible = true;
        }, 120); // blink duration (120ms)
    }
}

// global variable to store selected female voice
let femaleVoice = null;

function loadFemaleVoice() {
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return;

    // Try to find best female voices
    const preferredVoiceNames = [
        "Google UK English Female",
        "Google US English Female",
        "Microsoft Zira",
        "Microsoft Aria",
        "Microsoft Jenny",
        "Microsoft Sara",
        "en-US-AriaNeural",
        "en-US-JennyNeural"
    ];

    // First: best matches
    femaleVoice = voices.find(v => preferredVoiceNames.includes(v.name));

    // Second: fallback - any voice that looks female
    if (!femaleVoice) {
        femaleVoice = voices.find(v =>
            v.name.toLowerCase().includes("female") ||
            v.name.toLowerCase().includes("woman") ||
            v.name.toLowerCase().includes("girl") ||
            v.name.toLowerCase().includes("aria") ||
            v.name.toLowerCase().includes("zira")
        );
    }

    // Last fallback → first voice
    if (!femaleVoice) {
        femaleVoice = voices[0];
    }

    console.log("Selected Female Voice:", femaleVoice.name);
}

// Load voices when browser is ready
speechSynthesis.onvoiceschanged = loadFemaleVoice;

// ---------------- SPEECH SYNTHESIS ----------------
function avatarSpeak(text) {
    const utter = new SpeechSynthesisUtterance(text);

    if (Avatar == 'avatar_female.glb') {
        utter.voice = femaleVoice;  // ← SET FEMALE VOICE
    }

    utter.pitch = 1.2;
    utter.rate = 0.95;

    utter.onstart = () => startLipSync(text);
    utter.onend = () => stopLipSync();

    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
}

window.avatarSpeak = avatarSpeak;

// ---------------- BACKEND WEBSOCKET ----------------
const logEl = document.getElementById("log");
const ws = new WebSocket("ws://localhost:3002");

ws.onopen = () => logEl.innerHTML += "<div style='color:green'>➤ Connected to backend</div>";
ws.onerror = () => logEl.innerHTML += "<div style='color:red'>✖ WebSocket error</div>";
ws.onclose = () => logEl.innerHTML += "<div style='color:red'>✖ Disconnected</div>";

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "avatar_speech") {
        logEl.innerHTML += `<div><b>Bot:</b> ${data.text}</div>`;
        avatarSpeak(data.text);
    }
};

// ---------------- SEND USER MESSAGE ----------------
document.getElementById("sendBtn").onclick = sendMessage;
document.getElementById("message").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    const msg = document.getElementById("message").value.trim();
    if (!msg) return;

    ws.send(JSON.stringify({ type: "user_message", text: msg }));

    logEl.innerHTML += `<div><b>You:</b> ${msg}</div>`;
    document.getElementById("message").value = "";
}

// ---------------- RENDER LOOP ----------------
let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const delta = (now - prevTime) / 1000;
    prevTime = now;

    handleBlink(delta);

    animateBody(delta);

    renderer.render(scene, camera);
}
animate();

// ---------------- RESIZE ----------------
window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});
