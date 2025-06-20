/**
 * @file Manages player movement and input controls for both desktop and WebXR.
 * This class translates keyboard presses and controller inputs into player navigation
 * and triggers actions via a callback system.
 */

/**
 * Handles all user input for player navigation and interaction.
 */
export default class PlayerController {
    /**
     * @param {THREE.Group} player - The Group object representing the player.
     * @param {THREE.PerspectiveCamera} camera - The main camera.
     * @param {THREE.OrbitControls} controls - The desktop orbit controls.
     * @param {THREE.XRTargetRaySpace} controller1 - The first XR controller.
     * @param {THREE.XRTargetRaySpace} controller2 - The second XR controller.
     * @param {object} callbacks - A map of callback functions to trigger on input events.
     */
    constructor(player, camera, controls, controller1, controller2, callbacks) {
        this.player = player;
        this.camera = camera;
        this.controls = controls;
        this.controller1 = controller1;
        this.controller2 = controller2;
        this.callbacks = callbacks;
        this.controllerGuide = null;

        // --- Movement parameters ---
        this.moveSpeed = 3.0;
        this.rotationSpeed = 1.0;

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

        // --- Controller Event Listeners ---
        this.controller1.addEventListener('selectstart', () => this.callbacks.onMenuItemSelect());
        this.controller1.addEventListener('selectend', (event) => {
            // Future use if needed
        });
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
     * Per-frame update logic for the PlayerController.
     * @param {number} delta - The time delta since the last frame.
     * @param {XRSession|null} currentSession - The active WebXR session, if any.
     * @param {boolean} isMenuVisible - Whether the main menu is currently visible.
     * @param {boolean} isConsoleVisible - Whether the in-VR console is visible.
     */
    update(delta, currentSession, isMenuVisible, isConsoleVisible) {
        const moveVector = new THREE.Vector3();
        let rotationAmount = 0;

        // Get player's forward direction, ignoring vertical component.
        const forwardDirection = new THREE.Vector3();
        this.camera.getWorldDirection(forwardDirection);
        forwardDirection.y = 0;
        forwardDirection.normalize();

        const rightDirection = new THREE.Vector3();
        rightDirection.crossVectors(forwardDirection, this.player.up);

        if (currentSession) { 
            this.controls.enabled = false;
            let leftSource, rightSource;
            currentSession.inputSources.forEach(source => {
                if (source.handedness === 'left') leftSource = source;
                if (source.handedness === 'right') rightSource = source;
            });
            
            if (leftSource && leftSource.gamepad) {
                this.handleLeftController(delta, leftSource.gamepad, forwardDirection, moveVector, rotationAmount, isMenuVisible, isConsoleVisible);
            }
            
            if (rightSource && rightSource.gamepad) {
                this.handleRightController(delta, rightSource.gamepad, isConsoleVisible);
            }
        } else { // Desktop controls
            this.handleDesktopControls(delta, forwardDirection, rightDirection, moveVector, rotationAmount, isMenuVisible);
        }

        // Apply movement and rotation to the player group
        if (moveVector.lengthSq() > 0) {
            this.player.position.add(moveVector);
            if (!currentSession) this.controls.target.add(moveVector); // Move orbit controls target with player
        }
        if (rotationAmount !== 0) {
             this.player.rotation.y += rotationAmount;
        }
        
        if (!currentSession) this.controls.update();

        // Update visibility of the controller guide
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
     */
    handleLeftController(delta, gamepad, forwardDirection, moveVector, rotationAmount, isMenuVisible, isConsoleVisible) {
        const axes = gamepad.axes;
        const buttons = gamepad.buttons;
        
        const joystickTurn = axes[2] || 0;
        const joystickVertical = -axes[3] || 0; 

        const triggerValue = buttons[0] ? buttons[0].pressed : 0;
        const gripValue = buttons[1] ? buttons[1].pressed : 0;
        
        // Handle "clutch" movement with the grip button
        const gripEngaged = gripValue;
        if (gripEngaged && !this.isClutching) {
            this.isClutching = true;
            this.clutchStartPlayerPosition.copy(this.player.position);
            this.controller1.parent.localToWorld(this.clutchStartControllerPosition.setFromMatrixPosition(this.controller1.matrix));
        } else if (!gripEngaged && this.isClutching) {
            this.isClutching = false;
        }

        if (this.isClutching) {
            const currentControllerPosition = new THREE.Vector3();
            this.controller1.parent.localToWorld(currentControllerPosition.setFromMatrixPosition(this.controller1.matrix));
            const motionDelta = new THREE.Vector3().subVectors(currentControllerPosition, this.clutchStartControllerPosition);
            this.clutchTargetPlayerPosition.copy(this.clutchStartPlayerPosition).add(motionDelta);
            this.player.position.lerp(this.clutchTargetPlayerPosition, 0.02);
        } else {
            // Thumbstick vertical movement depends on context (menu, console, or world navigation)
            if (isMenuVisible) {
                if (Math.abs(joystickVertical) > 0.2) {
                    this.callbacks.onVRMenuScroll(joystickVertical * delta);
                }
            } else if (!isConsoleVisible) {
                if (Math.abs(joystickVertical) > 0.2) {
                    moveVector.add(forwardDirection.clone().multiplyScalar(joystickVertical * this.moveSpeed * delta));
                }
            }
        }
        
        if (Math.abs(joystickTurn) > 0.2 && !isConsoleVisible) {
            rotationAmount -= joystickTurn * this.rotationSpeed * delta;
        }
        
        // Trigger press also depends on context (select menu item or toggle info)
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
        
        // Menu button assigned to thumbstick click
        const hardwareMenuButton = buttons[3] && buttons[3].pressed;
        if (hardwareMenuButton && !this.menuButtonPressed) {
            this.menuButtonPressed = true;
            this.callbacks.onMenuToggle();
        } else if (!hardwareMenuButton) {
            this.menuButtonPressed = false;
        }

        // Y button (left controller) for Previous
        const prevButton = buttons[5] && buttons[5].pressed;
        if (prevButton && !this.periodKeyPressed) {
            this.periodKeyPressed = true;
            this.callbacks.onPrevImage();
        } else if (!prevButton) {
            this.periodKeyPressed = false;
        }
        
        // X button (left controller) for Next
        const nextButton = buttons[4] && buttons[4].pressed;
        if (nextButton && !this.commaKeyPressed) {
            this.commaKeyPressed = true;
            this.callbacks.onNextImage();
        } else if (!nextButton) {
            this.commaKeyPressed = false;
        }
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

        const aButton = buttons[4] && buttons[4].pressed;
        if (aButton && !this.consoleButtonPressed) {
            this.consoleButtonPressed = true;
            this.callbacks.onConsoleToggle();
        } else if (!aButton) {
            this.consoleButtonPressed = false;
        }

        const bButton = buttons[5] && buttons[5].pressed;
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
     * @param {THREE.Vector3} forwardDirection - The player's current forward direction.
     * @param {THREE.Vector3} rightDirection - The player's current right direction.
     * @param {THREE.Vector3} moveVector - The vector to apply movement to.
     * @param {number} rotationAmount - The amount to apply rotation by.
     * @param {boolean} isMenuVisible - Whether the menu is currently visible.
     */
    handleDesktopControls(delta, forwardDirection, rightDirection, moveVector, rotationAmount, isMenuVisible) {
        const anyMovementKey = this.keys.w || this.keys.s || this.keys.a || this.keys.d || this.keys.q || this.keys.e || this.keys.r || this.keys.f;
        this.controls.enabled = !anyMovementKey && !isMenuVisible;
        
        if(anyMovementKey) {
            if (this.keys.w) moveVector.add(forwardDirection.clone().multiplyScalar(this.moveSpeed * delta));
            if (this.keys.s) moveVector.add(forwardDirection.clone().multiplyScalar(-this.moveSpeed * delta));
            if (this.keys.d) rotationAmount -= this.rotationSpeed * delta; 
            if (this.keys.a) rotationAmount += this.rotationSpeed * delta;
            if (this.keys.e) moveVector.add(rightDirection.clone().multiplyScalar(this.moveSpeed * delta));
            if (this.keys.q) moveVector.add(rightDirection.clone().multiplyScalar(-this.moveSpeed * delta));
            if (this.keys.r) moveVector.y += this.moveSpeed * delta;
            if (this.keys.f) moveVector.y -= this.moveSpeed * delta;
        }

        if (this.keys['.'] && !this.periodKeyPressed) { this.periodKeyPressed = true; this.callbacks.onNextImage(); } 
        else if (!this.keys['.']) { this.periodKeyPressed = false; }
        if (this.keys[','] && !this.commaKeyPressed) { this.commaKeyPressed = true; this.callbacks.onPrevImage(); } 
        else if (!this.keys[',']) { this.commaKeyPressed = false; }
        if (this.keys.m && !this.mKeyPressed) { this.mKeyPressed = true; this.callbacks.onMenuToggle(); } 
        else if (!this.keys.m) { this.mKeyPressed = false; }
        if (this.keys.i && !this.iKeyPressed) { this.iKeyPressed = true; this.callbacks.onInfoToggle(); } 
        else if (!this.keys.i) { this.iKeyPressed = false; }
    }
}
