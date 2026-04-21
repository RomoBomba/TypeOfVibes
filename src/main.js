import * as THREE from 'three';
import { FirstPersonController } from 'three-first-person-controller';
import { GameScene } from './scenes/GameScene.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.5, 4);

const controller = new FirstPersonController(camera, {
    element: renderer.domElement,
    height: 1.6,
    moveSpeed: 5,
    lookSensitivity: 0.002,
    enablePointerLock: true,
    autoPointerLock: true,
});

const timer = new THREE.Timer();
const gameScene = new GameScene(renderer, camera, controller);

async function init() {
    await gameScene.initialize();

    function animate() {
        timer.update();
        const deltaTime = timer.getDelta();

        if (!gameScene.isSitting) {
            controller.update(deltaTime);
        }

        gameScene.update(deltaTime);
        renderer.render(gameScene.scene, camera);
        requestAnimationFrame(animate);
    }
    animate();
    console.log('✨ Проект запущен');
}

init();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') {
        console.log('🔔 E pressed');
        gameScene.toggleSitOnBench();
    }
});