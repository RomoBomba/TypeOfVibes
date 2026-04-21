import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export class GameScene {
    constructor(renderer, camera, controller) {
        this.renderer = renderer;
        this.camera = camera;
        this.controller = controller;
        this.scene = new THREE.Scene();

        this.isSitting = false;
        this.originalCameraPosition = new THREE.Vector3();
        this.originalCameraQuaternion = new THREE.Quaternion();

        this.sitEuler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.lookSensitivity = 0.002;
        this.mouseDelta = new THREE.Vector2();

        this.benchPosition = new THREE.Vector3(0, 0, -2.5);
        this.benchSitPosition = new THREE.Vector3(0, 0.8, -2.0);

        this.interactionDistance = 3.5;
        this.nearBench = false;
        this.hintElement = document.getElementById('interaction-hint');
        this.benchLoaded = false;

        this.worldRadius = 7.0;
        this.hdrList = ['sunset.hdr', 'mountain.hdr', 'kiara.hdr', 'hills.hdr', 'night.hdr'];
        this.currentHdrIndex = 0;
        this.skySphere = null;

        this.onMouseMove = this.onMouseMove.bind(this);
    }

    async initialize() {
        await this.setupSky();
        this.setupGround();
        this.setupLights();
        await this.loadBench();

        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('pointerlockchange', () => {
            if (!document.pointerLockElement && this.isSitting) {
                this.standUp();
            }
        });

        this.setupUI();
    }

    setupUI() {
        const btn = document.createElement('button');
        btn.textContent = '🌅 Сменить фон (F)';
        btn.style.position = 'absolute';
        btn.style.bottom = '100px';
        btn.style.left = '20px';
        btn.style.padding = '10px 20px';
        btn.style.background = 'rgba(0,0,0,0.5)';
        btn.style.color = 'white';
        btn.style.border = '1px solid rgba(255,255,255,0.3)';
        btn.style.borderRadius = '8px';
        btn.style.cursor = 'pointer';
        btn.style.zIndex = '20';
        btn.style.fontSize = '14px';
        btn.style.backdropFilter = 'blur(5px)';
        btn.onclick = () => this.toggleSky();
        document.body.appendChild(btn);
    }

    async toggleSky() {
        this.currentHdrIndex = (this.currentHdrIndex + 1) % this.hdrList.length;
        const hdrFile = this.hdrList[this.currentHdrIndex];

        const rgbeLoader = new RGBELoader();
        try {
            const texture = await rgbeLoader.loadAsync(`textures/sky/${hdrFile}`);
            texture.mapping = THREE.EquirectangularReflectionMapping;

            if (this.skySphere) {
                this.skySphere.material.map = texture;
                this.skySphere.material.needsUpdate = true;
            }

            this.adjustLightingForSky(hdrFile);
        } catch (error) {
            console.error('Ошибка смены фона:', error);
        }
    }

    adjustLightingForSky(hdrFile) {
        if (hdrFile.includes('night')) {
            if (this.dirLight) {
                this.dirLight.color.set(0xaaccff);
                this.dirLight.intensity = 0.15;
            }
            if (this.ambientLight) {
                this.ambientLight.color.set(0x223344);
                this.ambientLight.intensity = 0.25;
            }
            if (this.backLight) {
                this.backLight.color.set(0x446688);
                this.backLight.intensity = 0.15;
            }
        } else {
            if (this.dirLight) {
                this.dirLight.color.set(0xffeedd);
                this.dirLight.intensity = 0.8;
            }
            if (this.ambientLight) {
                this.ambientLight.color.set(0xffffff);
                this.ambientLight.intensity = 0.5;
            }
            if (this.backLight) {
                this.backLight.color.set(0xffaa66);
                this.backLight.intensity = 0.3;
            }
        }
    }

    async setupSky() {
        const rgbeLoader = new RGBELoader();
        try {
            const texture = await rgbeLoader.loadAsync(`textures/sky/${this.hdrList[0]}`);
            texture.mapping = THREE.EquirectangularReflectionMapping;

            const skyGeometry = new THREE.SphereGeometry(500, 64, 64);
            const skyMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide
            });
            this.skySphere = new THREE.Mesh(skyGeometry, skyMaterial);
            this.scene.add(this.skySphere);
        } catch (error) {
            console.error('Ошибка загрузки HDRI:', error);
            this.scene.background = new THREE.Color(0x111122);
        }
    }

    setupGround() {
        const groundGeo = new THREE.CircleGeometry(this.worldRadius + 0.5, 32);
        const groundMat = new THREE.MeshStandardMaterial({
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            visible: false
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        this.scene.add(ground);
    }

    setupLights() {
        this.dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
        this.dirLight.position.set(5, 10, 5);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 1024;
        this.dirLight.shadow.mapSize.height = 1024;
        const d = 10;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.dirLight.shadow.camera.near = 1;
        this.dirLight.shadow.camera.far = 30;
        this.dirLight.shadow.bias = -0.0005;
        this.scene.add(this.dirLight);

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(this.ambientLight);

        this.backLight = new THREE.PointLight(0xffaa66, 0.3);
        this.backLight.position.set(-3, 2, -5);
        this.scene.add(this.backLight);
    }

    async loadBench() {
        const loader = new GLTFLoader();
        try {
            const gltf = await loader.loadAsync('models/bench.glb');
            this.benchModel = gltf.scene;

            const bbox = new THREE.Box3().setFromObject(this.benchModel);
            const size = bbox.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2.0 / maxDim;
            this.benchModel.scale.set(scale, scale, scale);

            const newBbox = new THREE.Box3().setFromObject(this.benchModel);
            const newMin = newBbox.min;

            this.benchModel.position.x = this.benchPosition.x;
            this.benchModel.position.z = this.benchPosition.z;
            this.benchModel.position.y = this.benchPosition.y - newMin.y;
            this.benchModel.rotation.y = Math.PI;

            this.benchModel.traverse(node => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                    if (node.material) {
                        node.material.needsUpdate = true;
                    }
                }
            });
            this.scene.add(this.benchModel);

            const center = newBbox.getCenter(new THREE.Vector3());
            const maxY = newBbox.max.y;

            this.benchSitPosition.set(
                this.benchModel.position.x + center.x,
                this.benchModel.position.y + maxY + 0.25,
                this.benchModel.position.z + center.z - 0.3
            );

            this.benchLoaded = true;
        } catch (err) {
            console.error('Ошибка загрузки скамейки:', err);
            this.createSimpleBench();
            this.benchLoaded = true;
        }

        const zoneGeo = new THREE.SphereGeometry(this.interactionDistance, 8, 8);
        const zoneMat = new THREE.MeshBasicMaterial({ visible: false });
        this.interactionZone = new THREE.Mesh(zoneGeo, zoneMat);
        this.interactionZone.position.copy(this.benchPosition);
        this.scene.add(this.interactionZone);
    }

    createSimpleBench() {
        const group = new THREE.Group();
        const seat = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.1, 0.6),
            new THREE.MeshStandardMaterial({ color: 0x8b5e3c })
        );
        seat.position.y = 0.5;
        seat.castShadow = true;
        seat.receiveShadow = true;
        group.add(seat);
        group.position.copy(this.benchPosition);
        group.rotation.y = Math.PI;
        this.benchModel = group;
        this.scene.add(group);
        this.benchSitPosition.set(0, 0.9, -2.0);
    }

    onMouseMove(event) {
        if (!this.isSitting) return;

        this.mouseDelta.x = event.movementX || 0;
        this.mouseDelta.y = event.movementY || 0;

        this.sitEuler.y -= this.mouseDelta.x * this.lookSensitivity;
        this.sitEuler.x -= this.mouseDelta.y * this.lookSensitivity;
        this.sitEuler.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.sitEuler.x));

        this.camera.quaternion.setFromEuler(this.sitEuler);
    }

    update(deltaTime) {
        if (!this.benchLoaded) return;

        if (this.skySphere) {
            this.skySphere.position.copy(this.camera.position);
        }

        const pos = this.camera.position;
        const horizontalDist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        if (horizontalDist > this.worldRadius) {
            const angle = Math.atan2(pos.z, pos.x);
            pos.x = Math.cos(angle) * this.worldRadius;
            pos.z = Math.sin(angle) * this.worldRadius;
            this.camera.position.copy(pos);
        }

        if (this.isSitting) {
            this.camera.position.copy(this.benchSitPosition);
            this.controller.enabled = false;
        }

        const dist = this.camera.position.distanceTo(this.benchPosition);
        this.nearBench = dist < this.interactionDistance;

        if (this.hintElement) {
            this.hintElement.style.opacity = (this.nearBench && !this.isSitting) ? '1' : '0';
        }
    }

    standUp() {
        this.camera.position.copy(this.originalCameraPosition);
        this.camera.quaternion.copy(this.originalCameraQuaternion);
        this.controller.enabled = true;
        this.isSitting = false;
    }

    toggleSitOnBench() {
        if (this.isSitting) {
            this.standUp();
            document.exitPointerLock();
        } else if (this.nearBench) {
            this.originalCameraPosition.copy(this.camera.position);
            this.originalCameraQuaternion.copy(this.camera.quaternion);

            this.controller.enabled = false;
            this.camera.position.copy(this.benchSitPosition);

            this.sitEuler.set(0, 0, 0);
            this.camera.quaternion.setFromEuler(this.sitEuler);

            this.isSitting = true;
            this.renderer.domElement.requestPointerLock();
        }
    }
}