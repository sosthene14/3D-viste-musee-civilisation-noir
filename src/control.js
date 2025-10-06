import * as THREE from 'three';
import { Capsule } from "three/examples/jsm/math/Capsule.js";
import { Octree } from "three/examples/jsm/math/Octree.js";

const GRAVITY = 30;

export default class FirstPersonPlayer {
    constructor(camera, scene, container = document) {
        this.camera = camera;
        this.scene = scene;
        this.container = container || document;

        this.worldOctree = new Octree();

        this.playerCollider = new Capsule(
            new THREE.Vector3(0, 0.7, 0),
            new THREE.Vector3(0, 2, 0),
            0.7
        );
        this.playerVelocity = new THREE.Vector3();
        this.playerDirection = new THREE.Vector3();

        this.playerOnFloor = false;
        this.mousePress = false;

        this.keyStates = {};

        // Mobile controls
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.touchControls = {
            moveJoystick: { x: 0, y: 0, active: false },
            lookJoystick: { x: 0, y: 0, active: false }
        };

        this.setupEventListeners();
        
        if (this.isMobile) {
            this.createMobileControls();
        }

        this.playerCollisions = this.playerCollisions.bind(this);
        this.update = this.update.bind(this);
        this.updatePlayer = this.updatePlayer.bind(this);
        this.loadOctaTree = this.loadOctaTree.bind(this);
    }

    setupEventListeners() {
        // Keyboard events
        this.container.addEventListener('keydown', (event) => {
            this.keyStates[event.code] = true;
        });

        this.container.addEventListener('keyup', (event) => {
            this.keyStates[event.code] = false;
        });

        // Mouse events for desktop
        if (!this.isMobile) {
            this.container.addEventListener('mousedown', () => {
                this.mousePress = true;
            });

            this.container.addEventListener("mouseup", () => {
                this.mousePress = false;
            });

            this.container.addEventListener('mousemove', (event) => {
                if (this.mousePress) {
                    this.camera.rotation.y -= event.movementX / 500;
                    this.camera.rotation.x -= event.movementY / 500;
                }
            });
        }
    }

    createMobileControls() {
        // Create container for mobile controls
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'mobile-controls';
        controlsContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
        `;

        // Movement joystick (left side)
        const moveJoystick = this.createJoystick('left');
        controlsContainer.appendChild(moveJoystick.container);

        // Look joystick (right side)
        const lookJoystick = this.createJoystick('right');
        controlsContainer.appendChild(lookJoystick.container);

        // Jump button
        const jumpButton = document.createElement('div');
        jumpButton.style.cssText = `
            position: absolute;
            bottom: 120px;
            right: 30px;
            width: 60px;
            height: 60px;
            background: rgba(255, 255, 255, 0.3);
            border: 3px solid rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: white;
            font-weight: bold;
            user-select: none;
            touch-action: none;
        `;
        jumpButton.textContent = '↑';

        jumpButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.keyStates['Space'] = true;
            jumpButton.style.background = 'rgba(255, 255, 255, 0.5)';
        });

        jumpButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.keyStates['Space'] = false;
            jumpButton.style.background = 'rgba(255, 255, 255, 0.3)';
        });

        controlsContainer.appendChild(jumpButton);

        document.body.appendChild(controlsContainer);

        // Setup joystick handlers
        this.setupJoystickHandlers(moveJoystick, 'moveJoystick');
        this.setupJoystickHandlers(lookJoystick, 'lookJoystick');
    }

    createJoystick(side) {
        const container = document.createElement('div');
        container.style.cssText = `
            position: absolute;
            ${side}: 30px;
            bottom: 30px;
            width: 120px;
            height: 120px;
            pointer-events: auto;
        `;

        const base = document.createElement('div');
        base.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.2);
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
        `;

        const stick = document.createElement('div');
        stick.style.cssText = `
            position: absolute;
            width: 50px;
            height: 50px;
            background: rgba(255, 255, 255, 0.5);
            border: 3px solid rgba(255, 255, 255, 0.7);
            border-radius: 50%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            touch-action: none;
        `;

        container.appendChild(base);
        container.appendChild(stick);

        return { container, base, stick };
    }

    setupJoystickHandlers(joystick, controlType) {
        const maxDistance = 35;
        let touchId = null;

        const handleStart = (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            touchId = touch.identifier;
            this.touchControls[controlType].active = true;
        };

        const handleMove = (e) => {
            e.preventDefault();
            if (!this.touchControls[controlType].active) return;

            const touch = Array.from(e.touches).find(t => t.identifier === touchId);
            if (!touch) return;

            const rect = joystick.base.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            let deltaX = touch.clientX - centerX;
            let deltaY = touch.clientY - centerY;

            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (distance > maxDistance) {
                deltaX = (deltaX / distance) * maxDistance;
                deltaY = (deltaY / distance) * maxDistance;
            }

            joystick.stick.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;

            this.touchControls[controlType].x = deltaX / maxDistance;
            this.touchControls[controlType].y = deltaY / maxDistance;
        };

        const handleEnd = (e) => {
            e.preventDefault();
            touchId = null;
            this.touchControls[controlType].active = false;
            this.touchControls[controlType].x = 0;
            this.touchControls[controlType].y = 0;
            joystick.stick.style.transform = 'translate(-50%, -50%)';
        };

        joystick.container.addEventListener('touchstart', handleStart);
        joystick.container.addEventListener('touchmove', handleMove);
        joystick.container.addEventListener('touchend', handleEnd);
        joystick.container.addEventListener('touchcancel', handleEnd);
    }

    loadOctaTree(scene) {
        this.worldOctree.fromGraphNode(scene);
    }

    playerCollisions() {
        const result = this.worldOctree.capsuleIntersect(this.playerCollider);
        this.playerOnFloor = false;

        if (result) {
            this.playerOnFloor = result.normal.y > 0;
            if (!this.playerOnFloor) {
                this.playerVelocity.addScaledVector(result.normal, -result.normal.dot(this.playerVelocity));
            }
            if (result.depth >= 1e-10) {
                this.playerCollider.translate(result.normal.multiplyScalar(result.depth));
            }
        }
    }

    updatePlayer(deltaTime) {
        let damping = Math.exp(-4 * deltaTime) - 1;

        if (!this.playerOnFloor) {
            this.playerVelocity.y -= GRAVITY * deltaTime;
            damping *= 0.1;
        }

        this.playerVelocity.addScaledVector(this.playerVelocity, damping);
        const deltaPosition = this.playerVelocity.clone().multiplyScalar(deltaTime);
        this.playerCollider.translate(deltaPosition);
        this.playerCollisions();
        this.camera.position.copy(this.playerCollider.end);
    }

    update(deltaTime) {
        this.updatePlayer(deltaTime);
        this.updateControls(deltaTime);
        this.teleportPlayerIfOob();
    }

    getForwardVector() {
        this.camera.getWorldDirection(this.playerDirection);
        this.playerDirection.y = 0;
        this.playerDirection.normalize();
        return this.playerDirection;
    }

    getSideVector() {
        this.camera.getWorldDirection(this.playerDirection);
        this.playerDirection.y = 0;
        this.playerDirection.normalize();
        this.playerDirection.cross(this.camera.up);
        return this.playerDirection;
    }

    updateControls(deltaTime) {
        const speedDelta = deltaTime * (this.playerOnFloor ? 25 : 8);

        if (this.isMobile) {
            // Mobile joystick controls
            const moveJoy = this.touchControls.moveJoystick;
            const lookJoy = this.touchControls.lookJoystick;

            if (moveJoy.active) {
                // Forward/backward movement
                if (Math.abs(moveJoy.y) > 0.1) {
                    this.playerVelocity.add(this.getForwardVector().multiplyScalar(-moveJoy.y * speedDelta));
                }
                // Left/right movement
                if (Math.abs(moveJoy.x) > 0.1) {
                    this.playerVelocity.add(this.getSideVector().multiplyScalar(moveJoy.x * speedDelta));
                }
            }

            if (lookJoy.active) {
                // Camera rotation
                this.camera.rotation.y -= lookJoy.x * deltaTime * 2;
                this.camera.rotation.x -= lookJoy.y * deltaTime * 2;
                // Limit vertical rotation
                this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
            }
        } else {
            // Desktop keyboard controls
            if (this.keyStates['KeyW'] || this.keyStates['ArrowUp']) {
                this.playerVelocity.add(this.getForwardVector().multiplyScalar(speedDelta));
            }

            if (this.keyStates['KeyS'] || this.keyStates['ArrowDown']) {
                this.playerVelocity.add(this.getForwardVector().multiplyScalar(-speedDelta));
            }

            if (this.keyStates['KeyA'] || this.keyStates['ArrowLeft']) {
                this.playerVelocity.add(this.getSideVector().multiplyScalar(-speedDelta));
            }

            if (this.keyStates['KeyD'] || this.keyStates['ArrowRight']) {
                this.playerVelocity.add(this.getSideVector().multiplyScalar(speedDelta));
            }
        }

        // Jump (works for both desktop and mobile)
        if (this.playerOnFloor && this.keyStates['Space']) {
            this.playerVelocity.y = 15;
        }
    }

    teleportPlayerIfOob() {
        if (this.camera.position.y <= -25) {
            this.playerCollider.start.set(0, 0.7, 0);
            this.playerCollider.end.set(0, 2, 0);
            this.playerCollider.radius = 0.7;
            this.camera.position.copy(this.playerCollider.end);
            this.camera.rotation.set(0, 0, 0);
        }
    }

    // Method to clean up mobile controls when needed
    destroy() {
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.remove();
        }
    }
}