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
        this.hdrList = ['sunset.hdr', 'mountain.hdr', 'hills.hdr', 'night.hdr', 'lake.hdr', 'clear_night.hdr'];
        this.benchRotations = [180, 180, 96, 0, 0, 0];
        this.currentHdrIndex = 0;
        this.skySphere = null;

        this.localSitOffset = new THREE.Vector3(0, 0.25, -0.3);

        this.onMouseMove = this.onMouseMove.bind(this);
    }

    async initialize() {
        await this.setupSky();
        this.setupGround();
        this.setupLights();
        await this.loadBench();

        document.addEventListener('mousemove', this.onMouseMove);
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

    updateSitPosition() {
        if (!this.benchModel) return;
        const worldOffset = this.localSitOffset.clone();
        worldOffset.applyQuaternion(this.benchModel.quaternion);
        this.benchSitPosition.copy(this.benchModel.position).add(worldOffset);
        if (this.isSitting) {
            this.camera.position.copy(this.benchSitPosition);
        }
    }

    rotateBenchToAngle(degrees) {
        if (!this.benchModel) return;
        this.benchModel.rotation.y = THREE.MathUtils.degToRad(degrees);
        this.updateSitPosition();
    }

    async toggleSky() {
        this.currentHdrIndex = (this.currentHdrIndex + 1) % this.hdrList.length;
        const hdrFile = this.hdrList[this.currentHdrIndex];
        const rotation = this.benchRotations[this.currentHdrIndex];

        const rgbeLoader = new RGBELoader();
        try {
            const texture = await rgbeLoader.loadAsync(`textures/sky/${hdrFile}`);
            texture.mapping = THREE.EquirectangularReflectionMapping;

            if (this.skySphere) {
                this.skySphere.material.map = texture;
                this.skySphere.material.needsUpdate = true;
            }

            this.adjustLightingForSky(this.currentHdrIndex);
            this.rotateBenchToAngle(rotation);
        } catch (error) {
            console.error('Ошибка смены фона:', error);
        }
    }

    adjustLightingForSky(index) {
        const isHills = (index === 2);
        const isNight = (index === 3);
        const isLake = (index === 4);
        const isClearNight = (index === 5);
        const isSunset = (index === 0);

        if (this.skySphere && this.skySphere.material && this.skySphere.material.map) {
            if (isNight || isLake) {
                this.skySphere.material.map.anisotropy = this.skySphere.material.map.anisotropy || 16;
                this.scene.environmentIntensity = 0.25;
            } else {
                this.scene.environmentIntensity = 1.0;
            }
        }

        if (isHills) {
            if (this.dirLight) {
                this.dirLight.color.set(0xccbbaa);
                this.dirLight.intensity = 0.15;
            }
            if (this.ambientLight) {
                this.ambientLight.color.set(0x443322);
                this.ambientLight.intensity = 0.2;
            }
            if (this.backLight) {
                this.backLight.color.set(0x665544);
                this.backLight.intensity = 0.1;
            }
            if (this.fillLight) {
                this.fillLight.color.set(0xffffff);
                this.fillLight.intensity = 0.6;
            }
        } else if (isNight) {
            if (this.dirLight) {
                this.dirLight.intensity = 0;
            }
            if (this.ambientLight) {
                this.ambientLight.color.set(0x0a0a10);
                this.ambientLight.intensity = 0.05;
            }
            if (this.backLight) {
                this.backLight.intensity = 0;
            }
            if (this.fillLight) {
                this.fillLight.color.set(0x8899aa);
                this.fillLight.intensity = 0.4;
            }
        } else if (isLake) {
            if (this.dirLight) {
                this.dirLight.intensity = 0;
            }
            if (this.ambientLight) {
                this.ambientLight.color.set(0xffffff);
                this.ambientLight.intensity = 0.1;
            }
            if (this.backLight) {
                this.backLight.intensity = 0;
            }
            if (this.fillLight) {
                this.fillLight.color.set(0xffffff);
                this.fillLight.intensity = 0.45;
            }
        } else if (isClearNight) {
            if (this.dirLight) {
                this.dirLight.color.set(0xaaccff);
                this.dirLight.intensity = 0.15;
            }
            if (this.ambientLight) {
                this.ambientLight.color.set(0x334455);
                this.ambientLight.intensity = 0.25;
            }
            if (this.backLight) {
                this.backLight.color.set(0x557788);
                this.backLight.intensity = 0.15;
            }
            if (this.fillLight) {
                this.fillLight.color.set(0xaaccff);
                this.fillLight.intensity = 0.4;
            }
        } else if (isSunset) {
            if (this.dirLight) {
                this.dirLight.color.set(0xffeedd);
                this.dirLight.intensity = 0.4;
            }
            if (this.ambientLight) {
                this.ambientLight.color.set(0xffffff);
                this.ambientLight.intensity = 0.3;
            }
            if (this.backLight) {
                this.backLight.color.set(0xccaa88);
                this.backLight.intensity = 0.15;
            }
            if (this.fillLight) {
                this.fillLight.color.set(0xffeedd);
                this.fillLight.intensity = 0.2;
            }
        } else {
            if (this.dirLight) {
                this.dirLight.color.set(0xffeedd);
                this.dirLight.intensity = 0.5;
            }
            if (this.ambientLight) {
                this.ambientLight.color.set(0xffffff);
                this.ambientLight.intensity = 0.35;
            }
            if (this.backLight) {
                this.backLight.color.set(0xffaa66);
                this.backLight.intensity = 0.2;
            }
            if (this.fillLight) {
                this.fillLight.color.set(0xffeedd);
                this.fillLight.intensity = 0.3;
            }
        }
    }

    async setupSky() {
        const rgbeLoader = new RGBELoader();
        try {
            const texture = await rgbeLoader.loadAsync(`textures/sky/${this.hdrList[0]}`);
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.encoding = THREE.sRGBEncoding;

            const skyGeometry = new THREE.SphereGeometry(500, 64, 64);
            const skyMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide
            });
            this.skySphere = new THREE.Mesh(skyGeometry, skyMaterial);
            this.scene.add(this.skySphere);

            this.scene.environment = texture;
            this.scene.environmentIntensity = 1.0;
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
        this.dirLight = new THREE.DirectionalLight(0xffeedd, 0.5);
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

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
        this.scene.add(this.ambientLight);

        this.backLight = new THREE.PointLight(0xffaa66, 0.2);
        this.backLight.position.set(-3, 2, -5);
        this.scene.add(this.backLight);

        this.fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        this.fillLight.position.set(-5, 3, -5);
        this.scene.add(this.fillLight);
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
            this.benchModel.rotation.y = THREE.MathUtils.degToRad(this.benchRotations[0]);

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

            const center = new THREE.Vector3();
            newBbox.getCenter(center);
            const maxY = newBbox.max.y;
            this.localSitOffset.set(
                center.x,
                maxY + 0.25,
                center.z - 0.3
            );

            this.updateSitPosition();
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
        group.rotation.y = THREE.MathUtils.degToRad(this.benchRotations[0]);
        this.benchModel = group;
        this.scene.add(group);
        this.localSitOffset.set(0, 0.7, -0.2);
        this.updateSitPosition();
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