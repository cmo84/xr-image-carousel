/**
 * @file Manages player movement and input controls for both desktop and WebXR.
 * This class translates keyboard presses and controller inputs into player navigation
 * and triggers actions via a callback system.
 * v2.1 - Restored functionality by simplifying controller logic and fixing handedness detection.
 */

/**
 * Handles all user input for player navigation and interaction.
 */
export default class PlayerController {
    /**
     * @param {THREE.Group} player - The Group object representing the player.
     * @param {THREE.PerspectiveCamera} camera - The main camera.
     * @param {THREE.XRTargetRaySpace} controller1 - The first XR controller from the renderer.
     * @param {THREE.XRTargetRaySpace} controller2 - The second XR controller from the renderer.
     * @param {object} callbacks - A map of callback functions to trigger on input events.
     */
    constructor(player, camera, controller1, controller2, callbacks) {
        this.player = player;
        this.camera = camera;
        this.controller1 = controller1;
        this.controller2 = controller2;
        this.callbacks = callbacks;
        this.controllerGuide = null;

        // Defines button names and their corresponding index numbers.
        // If mappings change, you only need to update the numbers here.
        this.mapping = {
            trigger: 0,
            grip: 1,
            thumbstickClick: 3,
            buttonX: 4, // X on Left Controller, A on Right Controller
            buttonY: 5  // Y on Left Controller, B on Right Controller
        };

        // --- Movement parameters ---
        this.moveSpeed = 3.0;
        this.rotationSpeed = 1.0;
        this.mouseSensitivity = 0.002;

        // --- Mouse Look State ---
        this.isDragging = false;

        // --- State for keyboard input ---
        this.keys = { w: false, s: false, a: false, d: false, q: false, e: false, r: false, f: false, ',': false, '.': false, m: false, escape: false, i: false };
        
        // --- State for button presses (to prevent continuous firing) ---
        this.commaKeyPressed = false;
        this.periodKeyPressed = false;
        this.mKeyPressed = false;
        this.iKeyPressed = false;
        this.menuButtonPressed = false;
        this.consoleButtonPressed = false;
        this.triggerButtonPressed = false;
        this.bButtonPressed = false;

        // --- State for XR controller "clutch" movement ---
        this.isClutching = false;
        this.clutchStartPlayerPosition = new THREE.Vector3();
        this.clutchStartControllerPosition = new THREE.Vector3();
        this.clutchTargetPlayerPosition = new THREE.Vector3();
        
        this.controllerInfoVisible = false;

        // NOTE: Event listeners in the constructor were removed as they were unreliable
        // with controller handedness swaps. All input is now handled in the update loop.
    }

    /**
     * Sets the controller guide instance to be managed by this controller.
     * @param {XRControllerGuide} guide - The controller guide instance.
     */
    setControllerGuide(guide) {
        this.controllerGuide = guide;
    }

    /**
     * Toggles the visibility of the in-VR controller guide.
     */
    toggleControllerInfoVisibility() {
        this.controllerInfoVisible = !this.controllerInfoVisible;
    }

    /**
     * Handles key down events.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    handleKeyDown(e) {
        const key = e.key.toLowerCase();
        if (this.keys[key] !== undefined) this.keys[key] = true;
    }

    /**
     * Handles key up events.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        if (this.keys[key] !== undefined) this.keys[key] = false;
    }

    /**
     * Enables mouse look on mouse down.
     */
    startMouseLook() {
        this.isDragging = true;
    }

    /**
     * Disables mouse look on mouse up.
     */
    endMouseLook() {
        this.isDragging = false;
    }

    /**
     * Handles mouse movement for FPS-style look controls.
     * @param {MouseEvent} event - The mouse move event.
     */
    handleMouseMove(event) {
        if (!this.isDragging) return;

        this.player.rotation.y -= event.movementX * this.mouseSensitivity;
        this.camera.rotation.x -= event.movementY * this.mouseSensitivity;
        this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
    }

    /**
     * Per-frame update logic for the PlayerController.
     * @param {number} delta - The time delta since the last frame.
     * @param {XRSession|null} currentSession - The active WebXR session, if any.
     * @param {boolean} isMenuVisible - Whether the main menu is currently visible.
     * @param {boolean} isConsoleVisible - Whether the in-VR console is visible.
     */
    update(delta, currentSession, isMenuVisible, isConsoleVisible) {
        const moveVector = new THREE.Vector3();
        let rotationAmount = 0;

        if (currentSession) { 
            // Simplified loop to process controllers based on their actual, live handedness.
            // This correctly calls the handler for the appropriate hand every frame.
            for (const source of currentSession.inputSources) {
                if (!source.gamepad) continue;

                if (source.handedness === 'left') {
                    const forwardDirection = new THREE.Vector3();
                    this.camera.getWorldDirection(forwardDirection);
                    forwardDirection.y = 0;
                    forwardDirection.normalize();
                    rotationAmount = this.handleLeftController(delta, source.gamepad, forwardDirection, moveVector, rotationAmount, isMenuVisible, isConsoleVisible);
                } else if (source.handedness === 'right') {
                    this.handleRightController(delta, source.gamepad, isConsoleVisible);
                }
            }
        } else { // Desktop controls
            rotationAmount = this.handleDesktopControls(delta, moveVector, rotationAmount);
        }

        if (moveVector.lengthSq() > 0) {
            this.player.position.add(moveVector);
        }
        if (rotationAmount !== 0) {
             this.player.rotation.y += rotationAmount;
        }

        if (this.controllerGuide) {
            if (this.controllerInfoVisible) this.controllerGuide.show();
            else this.controllerGuide.hide();
        }
    }

    /**
     * Handles all inputs from the left XR controller.
     * @param {number} delta - Frame time delta.
     * @param {Gamepad} gamepad - The gamepad object for the controller.
     * @param {THREE.Vector3} forwardDirection - The player's current forward direction.
     * @param {THREE.Vector3} moveVector - The vector to apply movement to.
     * @param {number} rotationAmount - The amount to apply rotation by.
     * @param {boolean} isMenuVisible - Whether the menu is currently visible.
     * @param {boolean} isConsoleVisible - Whether the console is currently visible.
     * @returns {number} The calculated rotation amount.
     */
    handleLeftController(delta, gamepad, forwardDirection, moveVector, rotationAmount, isMenuVisible, isConsoleVisible) {
        const axes = gamepad.axes;
        const buttons = gamepad.buttons;
        
        const joystickTurn = axes[2] || 0;
        const joystickVertical = -axes[3] || 0; 

        const triggerValue = buttons[this.mapping.trigger]?.pressed || false;
        const gripValue = buttons[this.mapping.grip]?.pressed || false;
        
        const leftHandObject = this.controller1;

        const gripEngaged = gripValue;
        if (gripEngaged && !this.isClutching) {
            this.isClutching = true;
            this.clutchStartPlayerPosition.copy(this.player.position);
            leftHandObject.parent.localToWorld(this.clutchStartControllerPosition.setFromMatrixPosition(leftHandObject.matrix));
        } else if (!gripEngaged && this.isClutching) {
            this.isClutching = false;
        }

        if (this.isClutching) {
            const currentControllerPosition = new THREE.Vector3();
            leftHandObject.parent.localToWorld(currentControllerPosition.setFromMatrixPosition(leftHandObject.matrix));
            const motionDelta = new THREE.Vector3().subVectors(this.clutchStartControllerPosition, currentControllerPosition);
            this.clutchTargetPlayerPosition.copy(this.clutchStartPlayerPosition).add(motionDelta);
            this.player.position.lerp(this.clutchTargetPlayerPosition, 0.1);
        } else {
            if (isMenuVisible) {
                if (Math.abs(joystickVertical) > 0.2) this.callbacks.onVRMenuScroll(joystickVertical * delta);
            } else if (!isConsoleVisible) {
                if (Math.abs(joystickVertical) > 0.2) moveVector.add(forwardDirection.clone().multiplyScalar(joystickVertical * this.moveSpeed * delta));
            }
        }
        
        if (Math.abs(joystickTurn) > 0.2 && !isConsoleVisible) {
            rotationAmount -= joystickTurn * this.rotationSpeed * delta;
        }
        
        // This restores the trigger's dual functionality for menu selection and info toggle.
        const triggerPressed = triggerValue && !this.triggerButtonPressed;
        if (triggerPressed) {
            this.triggerButtonPressed = true;
            if (isMenuVisible) {
                this.callbacks.onMenuItemSelect();
            } else {
                this.callbacks.onInfoToggle();
            }
        } else if (!triggerValue) {
            this.triggerButtonPressed = false;
        }
        
        const hardwareMenuButton = buttons[this.mapping.thumbstickClick]?.pressed || false;
        if (hardwareMenuButton && !this.menuButtonPressed) {
            this.menuButtonPressed = true;
            this.callbacks.onMenuToggle();
        } else if (!hardwareMenuButton) {
            this.menuButtonPressed = false;
        }

        const prevButton = buttons[this.mapping.buttonY]?.pressed || false;
        if (prevButton && !this.periodKeyPressed) {
            this.periodKeyPressed = true;
            this.callbacks.onPrevImage();
        } else if (!prevButton) {
            this.periodKeyPressed = false;
        }
        
        const nextButton = buttons[this.mapping.buttonX]?.pressed || false;
        if (nextButton && !this.commaKeyPressed) {
            this.commaKeyPressed = true;
            this.callbacks.onNextImage();
        } else if (!nextButton) {
            this.commaKeyPressed = false;
        }

        return rotationAmount;
    }

    /**
     * Handles all inputs from the right XR controller.
     * @param {number} delta - Frame time delta.
     * @param {Gamepad} gamepad - The gamepad object for the controller.
     * @param {boolean} isConsoleVisible - Whether the console is currently visible.
     */
    handleRightController(delta, gamepad, isConsoleVisible) {
        const axes = gamepad.axes;
        const buttons = gamepad.buttons;

        if (isConsoleVisible) {
            const scrollX = axes[2] || 0;
            const scrollY = -axes[3] || 0;
            if (Math.abs(scrollX) > 0.1 || Math.abs(scrollY) > 0.1) {
                this.callbacks.onConsoleScroll(scrollX * 500 * delta, scrollY * 500 * delta);
            }
        }

        const aButton = buttons[this.mapping.buttonX]?.pressed || false;
        if (aButton && !this.consoleButtonPressed) {
            this.consoleButtonPressed = true;
            this.callbacks.onConsoleToggle();
        } else if (!aButton) {
            this.consoleButtonPressed = false;
        }

        const bButton = buttons[this.mapping.buttonY]?.pressed || false;
        if (bButton && !this.bButtonPressed) {
            this.bButtonPressed = true;
            this.callbacks.onControllerInfoToggle();
        } else if (!bButton) {
            this.bButtonPressed = false;
        }
    }

    /**
     * Handles all desktop keyboard inputs.
     * @param {number} delta - Frame time delta.
     * @param {THREE.Vector3} moveVector - The vector to apply movement to.
     * @param {number} rotationAmount - The amount to apply rotation by.
     * @returns {number} The calculated rotation amount.
     */
    handleDesktopControls(delta, moveVector, rotationAmount) {
        const forwardDirection = new THREE.Vector3();
        this.camera.getWorldDirection(forwardDirection);
        forwardDirection.y = 0;
        forwardDirection.normalize();

        const rightDirection = new THREE.Vector3();
        rightDirection.crossVectors(forwardDirection, new THREE.Vector3(0, 1, 0));
        
        if (this.keys.w) moveVector.add(forwardDirection.clone().multiplyScalar(this.moveSpeed * delta));
        if (this.keys.s) moveVector.add(forwardDirection.clone().multiplyScalar(-this.moveSpeed * delta));
        if (this.keys.q) moveVector.add(rightDirection.clone().multiplyScalar(-this.moveSpeed * delta));
        if (this.keys.e) moveVector.add(rightDirection.clone().multiplyScalar(this.moveSpeed * delta));
        if (this.keys.a) rotationAmount += this.rotationSpeed * delta; 
        if (this.keys.d) rotationAmount -= this.rotationSpeed * delta;
        if (this.keys.r) this.player.position.y += this.moveSpeed * delta;
        if (this.keys.f) this.player.position.y -= this.moveSpeed * delta;

        if (this.keys['.'] && !this.periodKeyPressed) { this.periodKeyPressed = true; this.callbacks.onNextImage(); } 
        else if (!this.keys['.']) { this.periodKeyPressed = false; }
        if (this.keys[','] && !this.commaKeyPressed) { this.commaKeyPressed = true; this.callbacks.onPrevImage(); } 
        else if (!this.keys[',']) { this.commaKeyPressed = false; }
        if (this.keys.m && !this.mKeyPressed) { this.mKeyPressed = true; this.callbacks.onMenuToggle(); } 
        else if (!this.keys.m) { this.mKeyPressed = false; }
        if (this.keys.i && !this.iKeyPressed) { this.iKeyPressed = true; this.callbacks.onInfoToggle(); } 
        else if (!this.keys.i) { this.iKeyPressed = false; }
        
        return rotationAmount;
    }
}
