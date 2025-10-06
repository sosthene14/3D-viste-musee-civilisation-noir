import "./style/index.css";
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import FirstPersonPlayer from './control';
import AnnotationDiv from "./annotationDiv";
import { initUploadModal, toastMessage } from "./utils";
import { getMuseumList } from "./services";
import { Museum } from "./constants";
import artworks from "./artworkData";
import QRCode from 'qrcode';

const clock = new THREE.Clock();
const scene = new THREE.Scene();

let model = null;
let menuOpen = false;
const STEPS_PER_FRAME = 5;
let fpView;
let gallery_mesh;
let annotationMesh = {};

const ModelPaths = {
    [Museum.ART_GALLERY]: "art_gallery/scene.gltf",
};

const ArtHolderToGLB = {
    "art_holder1": "buf1.glb",
    "art_holder2": "dogon2.glb",
    "art_holder3": "fang2.glb",
    "art_holder4": "femme_ch1.glb",
    "art_holder5": "femme_fs1.glb",
    "art_holder6": "nok2.glb",
    "art_holder7": "trone2.glb",
};

initUploadModal();

scene.background = new THREE.Color("#e6e6e6");
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.6, 0);

const container = document.getElementById('model-container');
container.tabIndex = 0;
container.focus();

const cssRenderer = new CSS2DRenderer();
cssRenderer.domElement.style.position = 'absolute';
cssRenderer.domElement.style.top = '0';
cssRenderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(cssRenderer.domElement);

const css3dRenderer = new CSS3DRenderer();
css3dRenderer.domElement.style.position = 'absolute';
css3dRenderer.domElement.style.top = '0';
css3dRenderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(css3dRenderer.domElement);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

// Load Google Model-Viewer script
const modelViewerScript = document.createElement('script');
modelViewerScript.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
modelViewerScript.type = 'module';
document.head.appendChild(modelViewerScript);

// Load QRCode library
const qrCodeScript = document.createElement('script');
qrCodeScript.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js';
qrCodeScript.type = 'module';
document.head.appendChild(qrCodeScript);

// Load Tailwind CSS
const tailwindScript = document.createElement('script');
tailwindScript.src = 'https://cdn.tailwindcss.com';
document.head.appendChild(tailwindScript);

window.addEventListener('resize', onWindowResize);

function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    cssRenderer.setSize(container.clientWidth, container.clientHeight);
    css3dRenderer.setSize(container.clientWidth, container.clientHeight);
}

container.addEventListener("keydown", (e) => {
    if (e.key === "Shift") {
        hideAnnotations();
    }
});

container.addEventListener("keyup", (e) => {
    if (e.key === "Shift") {
        showAnnotations();
    }
});

function openMenu() {
    menuOpen = true;
    document.getElementById("menu-container").style.display = "flex";
}

function closeMenu() {
    menuOpen = false;
    document.getElementById("menu-container").style.display = "none";
}

function createModal(artwork, glbPath) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden relative shadow-2xl';
    
    const loader = document.createElement('div');
    loader.className = 'absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 z-10';
    loader.innerHTML = `
        <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-400"></div>
    `;
    
    const modelViewer = document.createElement('model-viewer');
    modelViewer.className = 'w-full md:w-1/2 h-96 md:h-auto bg-white rounded-l-2xl';
    modelViewer.setAttribute('src', glbPath);
    modelViewer.setAttribute('auto-rotate', '');
    modelViewer.setAttribute('camera-controls', '');
    modelViewer.setAttribute('ar', '');
    modelViewer.setAttribute('shadow-intensity', '1');
    
    modelViewer.addEventListener('load', () => {
        loader.style.display = 'none';
    });
    
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'w-full md:w-1/2 p-8 text-white overflow-y-auto bg-gradient-to-b from-gray-800 to-gray-900';
    
    const langSelect = document.createElement('select');
    langSelect.className = 'mb-6 p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition';
    langSelect.innerHTML = `
        <option value="en">English</option>
        <option value="fr">Français</option>
        <option value="wo">Wolof</option>
    `;
    
    const qrCanvas = document.createElement('canvas');
    qrCanvas.className = 'mb-6 border-4 border-white rounded-lg';
    QRCode.toCanvas(qrCanvas, `https://hackaton-mus-v1.vercel.app/artwork/${artwork.id}`, { width: 150 }, (error) => {
        if (error) console.error('QR Code generation failed:', error);
    });
    
    const detailsContent = document.createElement('div');
    detailsContent.className = 'space-y-6';
    
    function updateDetailsContent(lang) {
        detailsContent.innerHTML = `
            <h2 class="text-3xl font-bold text-blue-300">${artwork.title[lang]}</h2>
            <p class="text-gray-200"><strong>Description:</strong> ${artwork.description[lang]}</p>
            <p class="text-gray-200"><strong>Artist:</strong> ${artwork.artist}</p>
            <p class="text-gray-200"><strong>Period:</strong> ${artwork.period}</p>
            <p class="text-gray-200"><strong>Origin:</strong> ${artwork.origin}</p>
            <p class="text-gray-200"><strong>Category:</strong> ${artwork.category}</p>
            <p class="text-gray-200"><strong>QR Code:</strong> Scan to visit artwork page</p>
        `;
    }
    
    updateDetailsContent('en');
    
    langSelect.addEventListener('change', (e) => {
        updateDetailsContent(e.target.value);
    });
    
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.className = 'absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition duration-300';
    closeButton.onclick = () => document.body.removeChild(modal);
    
    detailsDiv.appendChild(langSelect);
    detailsDiv.appendChild(qrCanvas);
    detailsDiv.appendChild(detailsContent);
    modalContent.appendChild(loader);
    modalContent.appendChild(modelViewer);
    modalContent.appendChild(detailsDiv);
    modalContent.appendChild(closeButton);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

const loader = new GLTFLoader().setPath('/assets/');
const textureLoader = new THREE.TextureLoader();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/assets/draco/');
loader.setDRACOLoader(dracoLoader);

function clearSceneObjects(obj) {
    while (obj.children.length > 0) {
        clearSceneObjects(obj.children[0]);
        obj.remove(obj.children[0]);
    }
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
        Object.keys(obj.material).forEach(prop => {
            if (obj.material[prop] && typeof obj.material[prop].dispose === 'function') {
                obj.material[prop].dispose();
            }
        });
        obj.material.dispose();
    }
}

function loadModel() {
    const loadingContainer = document.getElementById('loading-container');
    loadingContainer.style.display = 'flex';

    clearSceneObjects(scene);
    const light = new THREE.AmbientLight("#fff", 5);
    scene.add(light);

    console.log("Loading model from:", `/assets/${ModelPaths[Museum.ART_GALLERY]}`);
    loader.load(ModelPaths[Museum.ART_GALLERY], (gltf) => {
        model = gltf;
        scene.add(gltf.scene);

        let count = 0;
        annotationMesh = {};
        gltf.scene.traverse((child) => {
            if (child.isMesh && /^art_holder\d*$/.test(child.name)) {
                if (!(child.name in ArtHolderToGLB)) {
                    child.visible = false;
                    return;
                }

                count += 1;
                const box = new THREE.Box3().setFromObject(child);
                const center = new THREE.Vector3();
                box.getCenter(center);

                const annotationDiv = new AnnotationDiv(count, child.name);
                const label = new CSS2DObject(annotationDiv.getElement());
                label.position.set(center.x, center.y + 0.5, center.z);

                annotationMesh[child.name] = { label, annotationDiv, mesh: child };

                annotationDiv.onAnnotationDblClick = ({ event, id }) => {
                    const targetPosition = label.position;
                    const direction = new THREE.Vector3();
                    direction.subVectors(targetPosition, camera.position).normalize();
                    const distance = 2;
                    camera.position.addScaledVector(direction, distance);
                    camera.lookAt(targetPosition);
                };

                scene.add(label);

                const artwork = artworks.find(a => a.model3dUrl === `/${ArtHolderToGLB[child.name]}`);
                if (artwork && artwork.imageUrl) {
                    textureLoader.load(artwork.imageUrl, (texture) => {
                        const material = new THREE.MeshStandardMaterial({
                            map: texture,
                            metalness: 0.1,
                            roughness: 0.5
                        });
                        child.material = material;
                        child.material.needsUpdate = true;

                        // Add subtle emissive glow for hover effect
                        child.userData.originalMaterial = material;
                        child.userData.hovered = false;

                        const geometry = child.geometry;
                        const uvs = geometry.attributes.uv.array;
                        for (let i = 0; i < uvs.length; i += 2) {
                            uvs[i + 1] = 1 - uvs[i + 1];
                        }
                        geometry.attributes.uv.needsUpdate = true;
                    }, undefined, (error) => {
                        console.error(`Failed to load texture ${artwork.imageUrl}:`, error);
                        toastMessage(`Failed to load image for ${child.name}`);
                    });
                } else {
                    console.warn(`No imageUrl for ${child.name}`);
                    child.visible = false;
                }

                if (artwork) {
                    annotationDiv.setAnnotationDetails(artwork.title.en, artwork.description.en, artwork.artist);
                }
            }
        });

        // Raycaster for frame click detection
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        container.addEventListener('click', (event) => {
            if (menuOpen) return;

            mouse.x = (event.clientX / container.clientWidth) * 2 - 1;
            mouse.y = -(event.clientY / container.clientHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(Object.values(annotationMesh).map(item => item.mesh));

            if (intersects.length > 0) {
                const intersectedMesh = intersects[0].object;
                const artwork = artworks.find(a => a.model3dUrl === `/${ArtHolderToGLB[intersectedMesh.name]}`);
                if (artwork) {
                    createModal(artwork, `/assets/${ArtHolderToGLB[intersectedMesh.name]}`);
                } else {
                    toastMessage(`No details available for ${intersectedMesh.name}`);
                }
            }
        });

        // Hover effect
        container.addEventListener('mousemove', (event) => {
            mouse.x = (event.clientX / container.clientWidth) * 2 - 1;
            mouse.y = -(event.clientY / container.clientHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(Object.values(annotationMesh).map(item => item.mesh));

            Object.values(annotationMesh).forEach(({ mesh }) => {
                if (intersects.length > 0 && intersects[0].object === mesh) {
                    if (!mesh.userData.hovered) {
                        mesh.userData.hovered = true;
                        mesh.material = new THREE.MeshStandardMaterial({
                            map: mesh.userData.originalMaterial.map,
                            metalness: 0.3,
                            roughness: 0.4,
                            emissive: new THREE.Color(0x3333ff),
                            emissiveIntensity: 0.2
                        });
                    }
                } else {
                    if (mesh.userData.hovered) {
                        mesh.userData.hovered = false;
                        mesh.material = mesh.userData.originalMaterial;
                    }
                }
            });
        });

        onWindowResize();
        fpView = new FirstPersonPlayer(camera, scene, container);
        fpView.loadOctaTree(gltf.scene);
        fpView.updatePlayer(0.01);

        loadingContainer.style.display = 'none';
    }, (xhr) => {
        const progress = xhr.total > 0 ? (xhr.loaded / xhr.total) * 100 : (xhr.loaded / 60000);
    }, (error) => {
        console.error("Failed to load Art Gallery model:", error);
        toastMessage("Failed to load Art Gallery model. Please check the console for details.");
        loadingContainer.style.display = 'none';
        const geometry = new THREE.PlaneGeometry(10, 10);
        const material = new THREE.MeshBasicMaterial({ color: 0x808080 });
        const plane = new THREE.Mesh(geometry, material);
        plane.rotation.x = -Math.PI / 2;
        scene.add(plane);
    });
}

function hideAnnotations() {
    Object.values(annotationMesh).forEach(({ label }) => {
        label.element.style.opacity = "0";
    });
}

function showAnnotations() {
    Object.values(annotationMesh).forEach(({ label }) => {
        label.element.style.opacity = "1";
    });
}

function animate() {
    const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;
    for (let i = 0; i < STEPS_PER_FRAME; i++) {
        fpView?.update(deltaTime);
    }
    cssRenderer.render(scene, camera);
    css3dRenderer.render(scene, camera);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

loadModel();
animate();