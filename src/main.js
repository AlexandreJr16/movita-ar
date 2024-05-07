import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import SpriteText from "three-spritetext";

import "./style.css";

const initHammer = () => {
  const element = document.getElementById("seuElemento");
  const hammertime = new Hammer(element);
  hammertime.on("swipe", function (event) {
    console.log("Swiped!", event);
  });

  hammertime.on("pinch", function (event) {
    console.log("Pinched!", event);
  });
};

const URL_BASE = "http://localhost:3333/modelo3d/";
let lastX = 0; // Variável para armazenar a última posição X do toque

let lastRotationY = 0; // Variável para armazenar a rotação acumulada ao longo do eixo Y

let container,
  camera,
  scene,
  renderer,
  controller,
  reticle,
  obj3d,
  modelSupported,
  modelBlob,
  isMoving,
  apiUrl;
let hitTestSource = null,
  lastObject = null,
  hitTestSourceRequested = false,
  planeFound = false;

const objLoader = new GLTFLoader();

const getModelUrl = () => {
  return `${URL_BASE}${10}`;
};

const loadModel = () => {
  if (window.navigator.xr) {
    document.getElementById("ar-not-supported").innerHTML = "SIM";
  } else {
    document.getElementById("ar-not-supported").innerHTML = "Não";
  }

  modelSupported = true;

  scene = new THREE.Scene();
  const myText = new SpriteText(["OLAIDAND", 16, "white"]);

  objLoader.load("/m1.glb", (object) => {
    console.log(object);
    obj3d = object.scene;
  });

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

const init = () => {
  createContainer();
  createScene();
  createCamera();
  createLight();
  createRenderer();
  createARButton();
  createController();
  createReticle();
  addEventListeners();
};

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

const createLight = () => {
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);
};

const createRenderer = () => {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);
  renderer.xr.addEventListener("sessionstart", sessionStart);
};

const createARButton = () => {
  document.body.appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: ["local", "hit-test", "dom-overlay"],
      domOverlay: { root: document.querySelector("#overlay") },
    })
  );
};

const createController = () => {
  controller = renderer.xr.getController(0);
  // controller.addEventListener("select", onSelect);

  // Adiciona o ouvinte de evento de clique ao botão
  document.getElementById("btn").addEventListener("click", onSelect);

  document.addEventListener("touchmove", onTouchMove);

  scene.add(controller);
};

const createReticle = () => {
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
};

const addEventListeners = () => {
  window.addEventListener("resize", onWindowResize);
};

const onSelect = () => {
  if (reticle.visible && obj3d && !isMoving) {
    if (lastObject) {
      scene.remove(lastObject);
      lastObject = null;
    }

    const flower = obj3d.children[0];
    const mesh = flower.clone();

    reticle.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    const scale = 0.5;
    mesh.scale.set(scale, scale, scale);

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
    textWidth.position.set(object3DWidth * 1.5, 0, 0); // Posicione o texto na borda da largura (horizontalmente)
    textWidth.rotation.y = Math.PI / 2; // Rotacione o texto para que fique na vertical
    mesh.add(textWidth);

    const textHeight = new SpriteText(
      `A: ${object3DHeight.toFixed(2)}m`,
      0.1,
      "white"
    );
    textHeight.position.set(0, object3DHeight * 2, 0); // Posicione o texto na borda da altura (verticalmente)
    mesh.add(textHeight);

    const textDepth = new SpriteText(
      `P: ${object3DDepth.toFixed(2)}m`,
      0.1,
      "white"
    );
    textDepth.position.set(0, 0, object3DDepth); // Posicione o texto na borda da profundidade (no chão)
    mesh.add(textDepth);
    // Ajuste a posição do texto para que ele fique acima do objeto

    scene.add(mesh);

    const interval = setInterval(() => {
      mesh.scale.multiplyScalar(1.01);
    }, 16);
    setTimeout(() => {
      clearInterval(interval);

      // Compute bounding box to get dimensions after scaling
      const object3DWidth = boundingBox.max.x - boundingBox.min.x;
      const object3DHeight = boundingBox.max.y - boundingBox.min.y;
      const object3DDepth = boundingBox.max.z - boundingBox.min.z;

      // Log the dimensions
      console.log("Width after scaling:", object3DWidth);
      console.log("Height after scaling:", object3DHeight);
      console.log("Depth after scaling:", object3DDepth);
    }, 500);

    lastObject = mesh;
  }
};
const onTouchMove = async (event) => {
  if (event.touches.length === 1) {
    const touch = event.touches[0];
    const deltaX = touch.clientX - lastX; // lastX é a posição X anterior do toque, que precisa ser atualizado ao fim do movimento

    const rotationFactor = 500; // Ajuste conforme a sensibilidade desejada

    // Rotacionar com base no movimento horizontal de um dedo
    rotateObject(deltaX, rotationFactor);

    lastX = touch.clientX; // Atualiza a posição X para o próximo movimento
  } else if (event.touches.length === 2) {
    // Implementação futura para zoom
    performZoom(); // Função vazia ou com lógica inicial de zoom
  }
};

const rotateObject = (deltaX, rotationFactor) => {
  if (lastObject) {
    lastObject.rotation.y += deltaX / rotationFactor;
  }
};

const performZoom = () => {
  // Lógica para zoom (vazia por enquanto)
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

apiUrl = getModelUrl();
loadModel();
