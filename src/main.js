import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import SpriteText from "three-spritetext";

import "./style.css";
import axios from "axios";

const URL_BASE = "http://localhost:3333";
// const URL_BASE =
//   "https://7344-2804-14d-14a1-58b6-29d2-28d5-1872-d944.ngrok-free.app";

let container,
  camera,
  scene,
  renderer,
  controller,
  reticle,
  obj3d,
  modelSupported,
  id_value = 0;
let hitTestSource = null,
  lastObject = null,
  hitTestSourceRequested = false,
  planeFound = false;

const objLoader = new GLTFLoader();

const valuesOfModels = {
  0: { name: "modelo.glb", virado: true },
};

const getUrl = async () => {
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.has("id") && searchParams.has("id")) {
    const id = searchParams.get("id");
    const message = searchParams.get("message");
    console.log({ message, id });
    if (message == "true" && id) {
      const response = await axios.get(`${URL_BASE}/modelo3d/message/${id}`);
      if (response.modelo3D) return response.data;
      else return null;
    }

    id_value = id;
  } else {
    id_value = 0;
  }
};
const loadModel = async () => {
  if (window.navigator.xr) {
    document.getElementById("ar-not-supported").innerHTML = "SIM";
  } else {
    document.getElementById("ar-not-supported").innerHTML = "Não";
  }

  modelSupported = true;

  scene = new THREE.Scene();

  const data = await getUrl();
  console.log(data, "IBA");

  let modelBlob = data
    ? new Blob([new Uint8Array(data.modelo3D.data).buffer])
    : null;

  console.log(modelBlob);
  if (modelBlob) {
    objLoader.load(URL.createObjectURL(modelBlob), (gltf) => {
      console.log(gltf.scene);
      obj3d = gltf.scene;
      // Adicionando o modelo à cena

      scene.add(obj3d);
    });
  } else {
    objLoader.load(valuesOfModels[0].name, (object) => {
      console.log(object);
      obj3d = object.scene;
    });
  }
  initialize();
};

const initialize = () => {
  if (navigator.xr) {
    navigator.xr.isSessionSupported("immersive-ar").then(async (supported) => {
      if (!modelSupported) {
        document.getElementById("ar-not-supported").style.display = "none";
      } else if (supported) {
        const permissionGranted = await requestCameraPermission();
        if (permissionGranted) {
          document.getElementById("ar-not-supported").style.display = "none";
          document.getElementById("model-unsupported").style.display = "none";

          init();
          animate();
        } else {
          document.getElementById("model-unsupported").style.innerHTML =
            "Teste de desenvolvimento";
        }
      }
    });
  } else {
    document.getElementById("model-unsupported").style.display = "none";
  }
};

const requestCameraPermission = async () => {
  try {
    // Solicitar permissões de câmera
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    stream.getTracks().forEach((track) => track.stop()); // Parar o stream de vídeo após a verificação da permissão
    console.log(stream);
    return true; // Permissões concedidas
  } catch (error) {
    console.error("Erro ao solicitar permissões de câmera:", error);
    return false; // Permissões não concedidas
  }
};

const sessionStart = () => {
  planeFound = false;
  document.getElementById("tracking-prompt").style.display = "block";
};

async function requestARPermission() {
  // Verifica se o navegador suporta a API de permissões
  if (navigator.permissions) {
    try {
      // Solicita permissão para realidade aumentada
      const permissionStatus = await navigator.permissions.query({
        name: "camera",
      });
    } catch (error) {
      console.error("Erro ao solicitar permissão da câmera", error);
    }
  } else {
  }
}

// const init = () => {
//   createContainer();
//   createScene();
//   createCamera();
//   createLight();
//   createRenderer();
//   requestARPermission();

//   createARButton();
//   createController();
//   createReticle();
//   addEventListeners();
// };

const createContainer = () => {
  container = document.createElement("div");
  document.body.appendChild(container);
};

const createScene = () => {
  scene = new THREE.Scene();
};

const createCamera = () => {
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );
};

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

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  document.body.appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: ["local", "hit-test", "dom-overlay"],
      domOverlay: { root: document.querySelector("#overlay") },
    })
  );
  onSelect();
  createController();
  window.addEventListener("resize", onWindowResize);
}

//Gestules
const createController = () => {
  controller = renderer.xr.getController(0);
  // controller.addEventListener("select", onSelect);

  // Adiciona o ouvinte de evento de clique ao botão
  document.getElementById("btn").addEventListener("click", onSelect);

  document.addEventListener("touchmove", onTouchMove);

  scene.add(controller);
};

let lastX = 0;
let lastDistance = 0;

const onTouchMove = async (event) => {
  if (event.touches.length === 1) {
    const touch = event.touches[0];
    const deltaX = touch.clientX - lastX; // lastX é a posição X anterior do toque, que precisa ser atualizado ao fim do movimento
    const rotationFactor = 70; // Ajuste conforme a sensibilidade desejada

    // Rotacionar com base no movimento horizontal de um dedo
    rotateObject(deltaX, rotationFactor);
    lastX = touch.clientX;
  } else if (event.touches.length === 2) {
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
    );

    performZoom(distance);
  }
};

const rotateObject = (deltaX, rotationFactor) => {
  if (lastObject) {
    if (valuesOfModels[id_value].virado) {
      lastObject.rotation.y += deltaX / rotationFactor;
    } else {
      lastObject.rotation.x += deltaX / rotationFactor;
    }
  }
};
let updateTimeout;

//Zoom
const performZoom = (currentDistance) => {
  if (!lastObject) return;

  if (lastDistance !== 0) {
    const scaleFactor = currentDistance / lastDistance;
    lastObject.scale.multiplyScalar(scaleFactor);
  }
  lastDistance = currentDistance;

  // Clear any pending updates to prevent frequent recalculations
  clearTimeout(updateTimeout);

  // Debounce the updateMeasurements call
  updateTimeout = setTimeout(() => {
    updateMeasurements(lastObject); // Pass the correct object to update
  }, 200); // Adjust delay time as needed to optimize performance
};
const updateMeasurements = (mesh) => {
  // Primeiro, remova os textos antigos se eles existirem
  for (let i = mesh.children.length - 1; i >= 0; i--) {
    if (mesh.children[i].isMeasurementText) {
      mesh.remove(mesh.children[i]);
    }
  }

  // Atualiza as dimensões do objeto
  const boundingBox = new THREE.Box3().setFromObject(mesh);
  const object3DWidth = boundingBox.max.x - boundingBox.min.x;
  const object3DHeight = boundingBox.max.y - boundingBox.min.y;
  const object3DDepth = boundingBox.max.z - boundingBox.min.z;

  // Criação de novos textos de metragens
  const textWidth = new SpriteText(
    `L: ${object3DWidth.toFixed(2)}m`,
    0.1,
    "white"
  );
  textWidth.position.set(object3DWidth + 1, 0, 0);
  textWidth.rotation.y = Math.PI / 2;
  textWidth.isMeasurementText = true; // Marque o texto como um texto de medição
  mesh.add(textWidth);

  const textHeight = new SpriteText(
    `A: ${object3DHeight.toFixed(2)}m`,
    0.1,
    "white"
  );
  textHeight.position.set(0, object3DHeight + 1, 0);
  textHeight.isMeasurementText = true;
  mesh.add(textHeight);

  const textDepth = new SpriteText(
    `P: ${object3DDepth.toFixed(2)}m`,
    0.1,
    "white"
  );
  textDepth.position.set(0, 0, object3DDepth + 1);
  textDepth.isMeasurementText = true;
  mesh.add(textDepth);
};

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

const animate = () => {
  renderer.setAnimationLoop(render);
};

const render = (timestamp, frame) => {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (hitTestSourceRequested === false) {
      session.requestReferenceSpace("viewer").then((referenceSpace) => {
        session
          .requestHitTestSource({ space: referenceSpace })
          .then((source) => {
            hitTestSource = source;
          });
      });

      session.addEventListener("end", () => {
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
          document.getElementById("tracking-prompt").style.display = "none";
        }
        if (planeFound) {
          document.getElementById("btn").style.display = "flex";
        }
        const hit = hitTestResults[0];

        if (hit) {
          const hitMatrix = new THREE.Matrix4().fromArray(
            hit.getPose(referenceSpace).transform.matrix
          );
          const hitNormal = new THREE.Vector3(0, 0, -1);

          hitNormal.applyMatrix4(hitMatrix);
        }

        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
};

//Ao selecionar para criar um objeto
const onSelect = () => {
  if (reticle.visible && obj3d) {
    if (lastObject) {
      scene.remove(lastObject);
      lastObject = null;
    }

    const flower = obj3d.children[0];
    const mesh = flower.clone();

    reticle.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    const scale = 0.6;
    mesh.scale.set(scale, scale, scale);
    if (!valuesOfModels[id_value].virado) {
      mesh.rotation.x = Math.PI / 2;
    }

    // Adicione o texto como um filho do objeto móvel
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const object3DWidth = boundingBox.max.x - boundingBox.min.x;
    const object3DHeight = boundingBox.max.y - boundingBox.min.y;
    const object3DDepth = boundingBox.max.z - boundingBox.min.z;

    const textWidth = new SpriteText(
      `L: ${object3DWidth.toFixed(2)}m`,
      0.1,
      "white"
    );
    textWidth.position.set(object3DWidth * 1.7, 0, 0); // Posicione o texto na borda da largura (horizontalmente)
    textWidth.isMeasurementText = true; // Marque o texto como um texto de medição
    textWidth.rotation.y = Math.PI / 2; // Rotacione o texto para que fique na vertical

    mesh.add(textWidth);

    const textHeight = new SpriteText(
      `A: ${object3DHeight.toFixed(2)}m`,
      0.1,
      "white"
    );
    textHeight.position.set(0, object3DHeight * 2.3, 0); // Posicione o texto na borda da altura (verticalmente)
    textHeight.isMeasurementText = true;
    mesh.add(textHeight);

    const textDepth = new SpriteText(
      `P: ${object3DDepth.toFixed(2)}m`,
      0.1,
      "white"
    );
    textDepth.isMeasurementText = true;
    textDepth.position.set(0, 0, object3DDepth * 1.3); // Posicione o texto na borda da profundidade (no chão)
    mesh.add(textDepth);
    // Ajuste a posição do texto para que ele fique acima do objeto

    scene.add(mesh);

    const interval = setInterval(() => {
      mesh.scale.multiplyScalar(1.01);
    }, 16);
    setTimeout(() => {
      clearInterval(interval);
    }, 500);

    lastObject = mesh;
  }
};

// apiUrl = getModelUrl();
loadModel();
