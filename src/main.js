import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import SpriteText from "three-spritetext";
import "./style.css";
import axios from "axios";

const URL_BASE = "http://localhost:3333";
// const URL_BASE = "https://7344-2804-14d-14a1-58b6-29d2-28d5-1872-d944.ngrok-free.app";

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
  0: { name: "estante.glb", virado: true },
  1: { name: "mesa.glb", virado: true },
  2: { name: "modelo.glb", virado: true },
};

// Função para obter o URL do modelo 3D
const getUrl = async () => {
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.has("default")) {
    return { status: "default", number: Number(searchParams.get("default")) };
  }
  if (searchParams.has("id") && searchParams.has("message")) {
    const id = searchParams.get("id");
    const message = searchParams.get("message");
    console.log({ message, id });
    if (message == "true" && id) {
      const response = await axios.get(`${URL_BASE}/modelo3d/message/${id}`);
      if (response.data && response.data.modelo3D) return response.data;
      else return null;
    }
    id_value = id;
  } else {
    id_value = 0;
  }
  return null;
};

// Função para carregar o modelo 3D
const loadModel = async () => {
  if (navigator.xr) {
    document.getElementById("ar-not-supported").innerText = "SIM";
  } else {
    document.getElementById("ar-not-supported").innerText = "Não";
  }

  modelSupported = true;
  scene = new THREE.Scene();
  const data = await getUrl();
  if (data && "status" in data && data.status == "default") {
    console.log(data, "OLA");
    objLoader.load(valuesOfModels[Number(data.number)].name, (object) => {
      console.log(object);
      obj3d = object.scene;
    });
  } else {
    let modelBlob = data
      ? new Blob([new Uint8Array(data.modelo3D.data).buffer])
      : null;

    if (modelBlob) {
      objLoader.load(URL.createObjectURL(modelBlob), (gltf) => {
        // obj3d.receiveShadow = true;
        console.log(gltf.scene);
        obj3d = gltf.scene;
        scene.add(obj3d);
      });
    } else {
      objLoader.load(valuesOfModels[0].name, (object) => {
        console.log(object);
        obj3d = object.scene;
      });
    }
  }

  initialize();
};

// Função para inicializar a aplicação
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
          document.getElementById("model-unsupported").innerText =
            "Teste de desenvolvimento";
        }
      }
    });
  } else {
    document.getElementById("model-unsupported").style.display = "none";
  }
};

// Função para solicitar permissão da câmera
const requestCameraPermission = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });

    stream.getTracks().forEach((track) => track.stop());
    console.log(stream);
    return true;
  } catch (error) {
    console.error("Erro ao solicitar permissões de câmera:", error);
    return false;
  }
};

const sessionStart = () => {
  planeFound = false;
  document.getElementById("tracking-prompt").style.display = "block";
};

// Inicialização da cena
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

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.2);
  light.position.set(2, 2, 2);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Tipo de sombra suave para melhor qualidade

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
  createController();
  window.addEventListener("resize", onWindowResize);
}

// Função para criar o controlador de AR
const createController = () => {
  controller = renderer.xr.getController(0);
  document.getElementById("divBtn").addEventListener("click", onSelect);
  document.addEventListener("touchmove", onTouchMove);
  scene.add(controller);
};

let lastX = 0;
let lastDistance = 0;

// Função para manipulação de gestos
const onTouchMove = (event) => {
  if (event.touches.length === 1) {
    const touch = event.touches[0];
    const deltaX = touch.clientX - lastX;
    const rotationFactor = 70;
    rotateObject(deltaX, rotationFactor);
    lastX = touch.clientX; // Atualiza a última posição de toque
  } else if (event.touches.length === 2) {
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
    );
    performZoom(distance);
    lastDistance = distance; // Atualiza a última distância entre os dedos
  }
};

// Função para rotacionar o objeto
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

// Função para realizar o zoom
const performZoom = (currentDistance) => {
  if (!lastObject) return;
  if (lastDistance !== 0) {
    const scaleFactor = currentDistance / lastDistance;
    lastObject.scale.multiplyScalar(scaleFactor);
  }
  lastDistance = currentDistance;

  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    updateMeasurements(lastObject);
  }, 200);
};

// Função para atualizar as medições do objeto
const updateMeasurements = (mesh) => {
  for (let i = mesh.children.length - 1; i >= 0; i--) {
    if (mesh.children[i].isMeasurementText) {
      mesh.remove(mesh.children[i]);
    }
  }

  const boundingBox = new THREE.Box3().setFromObject(mesh);
  const object3DWidth = boundingBox.max.x - boundingBox.min.x;
  const object3DHeight = boundingBox.max.y - boundingBox.min.y;
  const object3DDepth = boundingBox.max.z - boundingBox.min.z;

  const textWidth = new SpriteText(
    `L: ${object3DWidth.toFixed(2)}m`,
    0.1,
    "white"
  );
  textWidth.position.set(object3DWidth + 1, 0, 0);
  textWidth.rotation.y = Math.PI / 2;
  textWidth.isMeasurementText = true;
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

// Função para ajustar a cena ao redimensionar a janela
const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

// Função para animação da cena
const animate = () => {
  renderer.setAnimationLoop(render);
};

// Função de renderização
const render = (timestamp, frame) => {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!hitTestSourceRequested) {
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
          document.getElementById("divBtn").style.display = "flex";
        }
        const hit = hitTestResults[0];
        const hitMatrix = new THREE.Matrix4().fromArray(
          hit.getPose(referenceSpace).transform.matrix
        );
        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
};

// Função de seleção para criar um objeto na cena
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

    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const object3DWidth = boundingBox.max.x - boundingBox.min.x;
    const object3DHeight = boundingBox.max.y - boundingBox.min.y;
    const object3DDepth = boundingBox.max.z - boundingBox.min.z;

    const textWidth = new SpriteText(
      `L: ${object3DWidth.toFixed(2)}m`,
      0.1,
      "white"
    );
    textWidth.position.set(object3DWidth * 1.7, 0, 0);
    textWidth.isMeasurementText = true;
    textWidth.rotation.y = Math.PI / 2;
    mesh.add(textWidth);

    const textHeight = new SpriteText(
      `A: ${object3DHeight.toFixed(2)}m`,
      0.1,
      "white"
    );
    textHeight.position.set(0, object3DHeight * 2.3, 0);
    textHeight.isMeasurementText = true;
    mesh.add(textHeight);

    const textDepth = new SpriteText(
      `P: ${object3DDepth.toFixed(2)}m`,
      0.1,
      "white"
    );
    textDepth.isMeasurementText = true;
    textDepth.position.set(0, 0, object3DDepth * 1.3);
    mesh.add(textDepth);

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

// Iniciar o carregamento do modelo
loadModel();
