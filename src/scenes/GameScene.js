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

        // Для вращения камеры при сидении
        this.sitEuler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.lookSensitivity = 0.002;
        this.mouseDelta = new THREE.Vector2();

        this.benchPosition = new THREE.Vector3(0, 0, -2.5);
        this.benchSitPosition = new THREE.Vector3(0, 0.8, -2.0);

        this.interactionDistance = 3.5;
        this.nearBench = false;
        this.hintElement = document.getElementById('interaction-hint');
        this.benchLoaded = false;

        // Привязываем обработчик мыши
        this.onMouseMove = this.onMouseMove.bind(this);
    }

    async initialize() {
        await this.setupSky();
        this.setupGround();
        this.setupLights();
        await this.loadBench();
        this.setupAtmosphere();

        // Добавляем слушатель мыши для вращения при сидении
        document.addEventListener('mousemove', this.onMouseMove);

        console.log('🏞️ Сцена готова');
    }

    async setupSky() {
        const rgbeLoader = new RGBELoader();
        try {
            const texture = await rgbeLoader.loadAsync('textures/sky/mountain.hdr');
            texture.mapping = THREE.EquirectangularReflectionMapping;

            const skyGeometry = new THREE.SphereGeometry(400, 60, 40);
            const skyMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide
            });
            const skySphere = new THREE.Mesh(skyGeometry, skyMaterial);
            skySphere.position.y = -30; // Опускаем горизонт
            this.scene.add(skySphere);

            this.scene.background = null;
            console.log('🌅 HDRI небо загружено');
        } catch (error) {
            console.error('Ошибка загрузки HDRI:', error);
            this.scene.background = null;
        }
    }

    setupGround() {
        // Прозрачная плоскость для ходьбы
        const groundGeo = new THREE.CircleGeometry(8, 32);
        const groundMat = new THREE.MeshStandardMaterial({
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Красивая граница
        const points = [];
        for (let i = 0; i <= 32; i++) {
            const angle = (i / 32) * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(angle) * 7.5, 0.02, Math.sin(angle) * 7.5));
        }
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffaa66 });
        this.scene.add(new THREE.Line(lineGeo, lineMat));

        console.log('👻 Прозрачная земля создана');
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

            this.benchModel.traverse(node => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            this.scene.add(this.benchModel);

            // Вычисляем точку сидения
            const center = newBbox.getCenter(new THREE.Vector3());
            const maxY = newBbox.max.y;

            // Смещаем камеру немного вперёд и выше
            this.benchSitPosition.set(
                this.benchModel.position.x + center.x,
                this.benchModel.position.y + maxY + 0.25,
                this.benchModel.position.z + center.z + 0.5  // Больше вперёд
            );

            this.benchLoaded = true;
            console.log('🪑 Скамейка загружена. Точка сидения:', this.benchSitPosition);
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
        this.benchModel = group;
        this.scene.add(group);
        this.benchSitPosition.set(0, 0.9, -2.0);
    }

    setupLights() {
        const dirLight = new THREE.DirectionalLight(0xffcc99, 1.2);
        dirLight.position.set(-10, 10, -10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        const d = 10;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = 30;
        this.scene.add(dirLight);

        const ambient = new THREE.AmbientLight(0x404060, 0.4);
        this.scene.add(ambient);
    }

    setupAtmosphere() {
        this.scene.fog = new THREE.FogExp2(0xffaa66, 0.015);
    }

    onMouseMove(event) {
        if (!this.isSitting) return;

        this.mouseDelta.x = event.movementX || 0;
        this.mouseDelta.y = event.movementY || 0;

        // Вращаем камеру при сидении
        this.sitEuler.y -= this.mouseDelta.x * this.lookSensitivity;
        this.sitEuler.x -= this.mouseDelta.y * this.lookSensitivity;
        this.sitEuler.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.sitEuler.x));

        this.camera.quaternion.setFromEuler(this.sitEuler);
    }

    update(deltaTime) {
        if (!this.benchLoaded) return;

        // При сидении фиксируем позицию, но разрешаем вращение
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

    toggleSitOnBench() {
        if (this.isSitting) {
            // Встаём
            this.camera.position.copy(this.originalCameraPosition);
            this.camera.quaternion.copy(this.originalCameraQuaternion);
            this.controller.enabled = true;
            this.isSitting = false;
            document.exitPointerLock(); // Выходим из захвата мыши
            console.log('🚶 Встали');
        } else if (this.nearBench) {
            // Садимся
            this.originalCameraPosition.copy(this.camera.position);
            this.originalCameraQuaternion.copy(this.camera.quaternion);

            this.controller.enabled = false;
            this.camera.position.copy(this.benchSitPosition);

            // Устанавливаем начальный угол обзора (на закат)
// Если закат впереди (отрицательная Z) — Y = 0
// Если закат справа — Y = -Math.PI/2 (или 1.57)
// Если закат слева — Y = Math.PI/2
            this.sitEuler.set(-0.1, 0, 0); // Чуть вниз и прямо
            this.camera.quaternion.setFromEuler(this.sitEuler);


            this.isSitting = true;

            // Захватываем мышь для вращения
            this.renderer.domElement.requestPointerLock();

            console.log('🧘 Сели, можно крутить головой');
        }
    }
}