import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let acrylicMesh, ledPointsMesh, outlineGroup, pointLight;
let container, loader;

export function initThree(containerId, loaderId) {
    container = document.getElementById(containerId);
    loader = document.getElementById(loaderId);
    if (loader) loader.style.display = 'flex';
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    const aspect = container.clientWidth / (container.clientHeight || 420);
    camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 2000);
    camera.position.set(40, 30, 80);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight || 420);
    container.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 15;
    controls.maxDistance = 400;
    controls.target.set(0, 0, 0);
    controls.update();
    scene.add(new THREE.AmbientLight(0x303050, 3.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(50, 80, 60);
    scene.add(dirLight);
    if (loader) loader.style.display = 'none';
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        if (pointLight && !document.hidden) {
            pointLight.intensity = 10 + Math.sin(Date.now() * 0.004) * 2.5;
        }
        renderer.render(scene, camera);
    }
    animate();
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / (container.clientHeight || 420);
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight || 420);
    });
}

export function updatePreview(wCm, hCm, holes, holeRmm, ledColor, outlinesCm) {
    if (!scene) return;
    if (acrylicMesh) { scene.remove(acrylicMesh); acrylicMesh.geometry?.dispose(); }
    if (ledPointsMesh) { scene.remove(ledPointsMesh); ledPointsMesh.geometry?.dispose(); }
    if (outlineGroup) { scene.remove(outlineGroup); outlineGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    if (pointLight) { scene.remove(pointLight); }
    const color = new THREE.Color(ledColor);
    const x3d = wCm, y3d = hCm, thickness = 0.7, r3d = holeRmm / 10;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(x3d, 0); shape.lineTo(x3d, y3d); shape.lineTo(0, y3d); shape.closePath();
    acrylicMesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }),
        new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, metalness: 0.05, roughness: 0.08, transmission: 0.85, opacity: 0.35, transparent: true, clearcoat: 0.9, ior: 1.5 })
    );
    acrylicMesh.position.set(-x3d/2, -y3d/2, -thickness/2);
    scene.add(acrylicMesh);
    outlineGroup = new THREE.Group();
    outlinesCm.forEach(path => {
        if (path.length < 2) return;
        const points = path.map(p => new THREE.Vector3(p.x - x3d/2, y3d - p.y - y3d/2, thickness/2 + 0.02));
        outlineGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xffffff })));
    });
    scene.add(outlineGroup);
    if (holes.length > 0) {
        const positions = holes.map(h => new THREE.Vector3(h.x - x3d/2, y3d - h.y - y3d/2, -thickness/2 - 0.15));
        ledPointsMesh = new THREE.Points(
            new THREE.BufferGeometry().setFromPoints(positions),
            new THREE.PointsMaterial({ color, size: r3d * 2.8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthTest: false })
        );
        scene.add(ledPointsMesh);
        pointLight = new THREE.PointLight(color, 12, Math.max(x3d, y3d)*2.5);
        pointLight.position.set(0, 0, -thickness);
        scene.add(pointLight);
    }
    const maxDim = Math.max(x3d, y3d);
    camera.position.set(maxDim * 0.3, y3d * 0.35, maxDim / (2 * Math.tan(55 * Math.PI / 360)) + thickness * 3);
    camera.lookAt(0,0,0);
    controls.target.set(0,0,0);
    controls.update();
}
