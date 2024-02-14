import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import "./style.css";

const API_URL =
  "https://1163-2804-14d-14a1-58b6-c414-cfd7-e942-ef1e.ngrok-free.app";

let container;
let camera, scene, renderer;
let controller;
let reticle;
let hitTestSource = null;
let lastObject = null;
let hitTestSourceRequested = false;
let planeFound = false;
let obj3d;
let modelSuported;
let modelBlob;
const URL_BASE = "http://localhost:3000/modelo3d/";

const objLoader = new GLTFLoader();
const getModel = () => {
  const urlAtual = window.location.href;
  console.log("URL atual:", urlAtual);
  const match = urlAtual.match(/\/(\d+)$/);
  console.log(match);

  const apiUrl = `${URL_BASE}1`;

  fetch(apiUrl)
    .then((response) => response.json())
    .then((data) => {
      if (data.message) {
        console.log("Nao suportado");
        modelSuported = false;
      } else {
        modelSuported = true;

        scene = new THREE.Scene();

        modelBlob = new Blob([
          new Uint8Array(data.modelo3D.modelBin.data).buffer,
        ]);
        objLoader.load(URL.createObjectURL(modelBlob), (gltf) => {
          obj3d = gltf.scene;

          // Adicionando o modelo à cena

          scene.add(obj3d);
        });
      }
      iniciar();
    })
    .catch((error) => {
      console.error("Error fetching or parsing the 3D model:", error);
    });
};

const iniciar = () => {
  if ("xr" in navigator) {
    navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
      if (!modelSuported) {
        console.log("Sem modelo");
        document.getElementById("ar-not-supported").style.display = "none";
      } else if (supported) {
        console.log("supported ar");
        document.getElementById("ar-not-supported").style.display = "none";
        document.getElementById("model-unsupported").style.display = "none";

        init();
        animate();
      }
    });
  }
};

function sessionStart() {
  planeFound = false;
  document.getElementById("tracking-prompt").style.display = "block";
}

function init() {
  container = document.createElement("div");
  document.body.appendChild(container);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  renderer.xr.addEventListener("sessionstart", sessionStart);

  document.body.appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: ["local", "hit-test", "dom-overlay"],
      domOverlay: { root: document.querySelector("#overlay") },
    })
  );

  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // Carregue o modelo 3D a partir da API

  function onSelect() {
    if (reticle.visible && obj3d) {
      if (lastObject) {
        scene.remove(lastObject);
        lastObject = null;
      }

      const flower = obj3d.children[0];
      const mesh = flower.clone();

      reticle.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
      const scale = 1;
      mesh.scale.set(scale, scale, scale);
      mesh.rotateX(Math.PI / 2);
      scene.add(mesh);

      const interval = setInterval(() => {
        mesh.scale.multiplyScalar(1.01);
      }, 16);
      setTimeout(() => {
        clearInterval(interval);
      }, 500);

      lastObject = mesh;
    }
  }

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (hitTestSourceRequested === false) {
      session.requestReferenceSpace("viewer").then(function (referenceSpace) {
        session
          .requestHitTestSource({ space: referenceSpace })
          .then(function (source) {
            hitTestSource = source;
          });
      });

      session.addEventListener("end", function () {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length) {
        if (!planeFound) {
          planeFound = true;
          // Esconda #tracking-prompt
          document.getElementById("tracking-prompt").style.display = "none";
          document.getElementById("instructions").style.display = "flex";
        }
        const hit = hitTestResults[0];

        if (hit) {
          const hitMatrix = new THREE.Matrix4().fromArray(
            hit.getPose(referenceSpace).transform.matrix
          );
          const hitNormal = new THREE.Vector3(0, 0, -1); // Vetor vertical para cima, assumindo um sistema de coordenadas padrão

          hitNormal.applyMatrix4(hitMatrix);

          // Verifica a orientação do plano
        }

        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
}

function setMessage(text) {
  const messageElement = document.getElementById("message");
  if (messageElement) {
    messageElement.textContent = text;
  }
}

function base64ToArrayBuffer(base64) {
  var binaryString = atob(base64);
  var bytes = new Uint8Array(binaryString.length);
  for (var i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
getModel();
