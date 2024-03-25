import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";

import "./style.css";

const URL_BASE = "http://localhost:3333/modelo3d/";

// const URL_BASE =
// "https://dbe0-2804-14d-14a1-58b6-587d-e4b9-3e8a-9eae.ngrok-free.app/modelo3d/";
let container,
  camera,
  scene,
  renderer,
  controller,
  reticle,
  obj3d,
  modelSupported,
  modelBlob,
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
  // fetch(apiUrl, {
  //   headers: new Headers({
  //     "ngrok-skip-browser-warning": "69420",
  //   }),
  // })
  //   .then((response) => response.json())
  //   .then((data) => {
  modelSupported = true;
  // console.log(data);

  scene = new THREE.Scene();

  // modelBlob = new Blob([new Uint8Array(data.modelo3D.modelBin.data).buffer]);

  // objLoader.load(URL.createObjectURL(modelBlob), (gltf) => {
  //   obj3d = gltf.scene;
  //   scene.add(obj3d);
  // });
  objLoader.load("modelo.glb", (object) => {
    console.log(object);
    obj3d = object.scene;
  });
  // })
  // .catch((error) => {
  //   console.error("Error fetching model from the database", error);
  // })
  // .finally(() => initialize());
  initialize();
};

const initialize = () => {
  if (navigator.xr) {
    navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
      if (!modelSupported) {
        document.getElementById("ar-not-supported").style.display = "none";
      } else if (supported) {
        document.getElementById("ar-not-supported").style.display = "none";
        document.getElementById("model-unsupported").style.display = "none";

        init();
        animate();
      }
    });
  } else {
    document.getElementById("model-unsupported").style.display = "none";
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
  controller.addEventListener("select", onSelect);
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
    // mesh.rotateX(Math.PI / 2);

    // Adicione um manipulador de eventos de toque/mouse para detecção de gestos de dois dedos
    document.addEventListener("touchmove", onTouchMove);

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
const onTouchMove = (event) => {
  // Verifique se há dois dedos na tela
  if (event.touches.length === 2) {
    // Obtenha as posições dos dois dedos
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];

    // Calcule a diferença de posição entre os dois dedos
    const deltaX = touch2.clientX - touch1.clientX;
    const deltaY = touch2.clientY - touch1.clientY;

    // Calcule o ângulo de rotação com base na diferença de posição
    const angle = Math.atan2(deltaY, deltaX);

    // Ajuste o fator de escala para diminuir a sensibilidade da rotação
    const rotationFactor = 0.01; // Ajuste esse valor conforme necessário

    // Aplique a rotação ao objeto 3D com base no ângulo e no fator de escala
    if (lastObject) {
      lastObject.rotation.y += angle * rotationFactor;
    }
  }
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
          document.getElementById("tracking-prompt").style.display = "none";
          document.getElementById("instructions").style.display = "flex";
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
``;
