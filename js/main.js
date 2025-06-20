/**
 * @file Main application entry point and orchestrator.
 * This script initializes the 3D scene, renderer, camera, and all the major application modules.
 * It sets up the core event listeners and runs the main animation loop.
 */

import XRControllerGuide from './XRControllerGuide.js';
import InVRConsole from './InVRConsole.js';
import WebXRButton from './WebXRButton.js';
import ArtManager from './ArtManager.js';
import PlayerController from './PlayerController.js';
import GalleryMenu from './GalleryMenu.js';

// Core Three.js components
let camera, scene, renderer, clock, textureLoader, controls;

// Player and XR controller objects
let player, controller1, controller2, controllerGrip1, controllerGrip2;

// Application state and modules
let currentSession = null;
let controllerGuide = null;
let inVRConsole = null;
let artManager, playerController, galleryMenu;

/**
 * The default height of the player in the virtual world, used for camera positioning and artwork placement.
 * @type {number}
 */
const PLAYER_HEIGHT = 1.6;

// Initialize the application
init();

/**
 * Initializes the entire application.
 * Sets up the scene, camera, renderer, lights, modules, and event listeners.
 */
function init() {
    // --- Basic Scene Setup ---
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    
    clock = new THREE.Clock();
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

    textureLoader = new THREE.TextureLoader();

    // --- DOM and Player Setup ---
    const xrButtonContainer = WebXRButton.createButton(renderer);
    document.body.appendChild(xrButtonContainer);

    player = new THREE.Group();
    player.add(camera);
    scene.add(player);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xeeeeee);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 0.5, 50);
    camera.add(pointLight);
    
    // Append renderer to the container
    document.getElementById('container').appendChild(renderer.domElement);
    
    // Initialize controller objects
    setupControllers();

    // Standard desktop controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    
    // --- Module Instantiation ---
    // The main script acts as an orchestrator, passing necessary components and callbacks to each module.
    inVRConsole = new InVRConsole(camera);
    artManager = new ArtManager(scene, camera, renderer, textureLoader, PLAYER_HEIGHT);
    galleryMenu = new GalleryMenu(camera, renderer, controller1, () => {
        artManager.resetGallery();
        resetPlayerState();
    });
    playerController = new PlayerController(player, camera, controls, controller1, controller2, {
        onMenuToggle: () => galleryMenu.toggleMenu(),
        onNextImage: () => artManager.selectNextImage(),
        onPrevImage: () => artManager.selectPreviousImage(),
        onInfoToggle: () => artManager.toggleDiagnosticMode(),
        onConsoleToggle: () => {
            // This button now toggles the In-VR Console
            if (inVRConsole.visible) inVRConsole.hide();
            else inVRConsole.show();
        },
        onControllerInfoToggle: () => playerController.toggleControllerInfoVisibility(),
        onMenuItemSelect: () => galleryMenu.selectCurrentItem(),
        onVRMenuScroll: (delta) => galleryMenu.scrollVRMenu(delta),
        onConsoleScroll: (dx, dy) => inVRConsole.scroll(dx, dy)
    });

    // --- Global Event Listeners ---
    renderer.xr.addEventListener('sessionstart', onSessionStart);
    renderer.xr.addEventListener('sessionend', onSessionEnd);
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', (e) => playerController.handleKeyDown(e));
    window.addEventListener('keyup', (e) => playerController.handleKeyUp(e));
    
    // Initial setup of the experience
    resetExperience();
    // Start the main loop
    animate();
}

/**
 * Handles the start of a WebXR session.
 * @param {Event} event - The WebXR session start event.
 */
function onSessionStart(event) {
    currentSession = renderer.xr.getSession();
    const session = event.target.getSession();

    // Set background based on the environment blend mode (e.g., opaque for VR, transparent for AR)
    if (session.environmentBlendMode === 'opaque') {
        scene.background = new THREE.Color(0x1a1a1a);
    } else {
        scene.background = null; 
    }
    
    // Initialize and link the controller guide for in-VR instructions
    controllerGuide = new XRControllerGuide(controllerGrip2);
    playerController.setControllerGuide(controllerGuide);

    resetExperience(); 
}

/**
 * Handles the end of a WebXR session.
 * Cleans up XR-specific objects and resets the camera and controls for desktop view.
 */
function onSessionEnd() {
    if (controllerGuide) {
        controllerGuide.dispose();
        controllerGuide = null;
        playerController.setControllerGuide(null);
    }
    currentSession = null;
    scene.background = new THREE.Color(0x101010);
    
    // Re-enable orbit controls and reset camera for desktop
    controls.enabled = true; 
    camera.position.set(0, PLAYER_HEIGHT, 3);
    player.position.set(0, 0, 0); 
    controls.target.set(0, PLAYER_HEIGHT, 0);
    controls.update();

    galleryMenu.hideMenu();
}

/**
 * Creates and sets up the WebXR controller objects.
 */
function setupControllers() {
    controller1 = renderer.xr.getController(0); // Typically left hand
    controller2 = renderer.xr.getController(1); // Typically right hand
    
    controllerGrip1 = renderer.xr.getControllerGrip(0);
    controllerGrip2 = renderer.xr.getControllerGrip(1);
    
    // Add controllers to the player group so they move with the player
    player.add(controller1, controller2, controllerGrip1, controllerGrip2);
}

/**
 * Resets the entire gallery experience to its initial state.
 * This is called on startup and when loading a new gallery.
 */
function resetExperience() {
    artManager.resetGallery();
    resetPlayerState();
}

/**
 * Resets the player's position and orientation.
 * Positions the player differently for VR vs. desktop mode.
 */
function resetPlayerState() {
    const galleryRadius = artManager.getGalleryRadius();
    player.position.set(0, 0.8, 0); // Set player height directly
    player.rotation.set(0, Math.PI, 0);
    player.position.z = galleryRadius - 2; // Start closer to the first painting

    if (renderer.xr.isPresenting) {
        // In XR, camera is at the player's origin
        controls.enabled = false;
        camera.position.set(0, 0, 0);
        camera.rotation.set(0, 0, 0);
    } else {
        // In desktop mode, position camera behind the player origin
        scene.background = new THREE.Color(0x101010);
        camera.position.set(0, 1.2, 3); // Lower desktop camera
        controls.target.set(player.position.x, PLAYER_HEIGHT + 0.3, player.position.z);
        controls.update();
    }
}

/**
 * The main animation loop.
 * This function is called every frame to update the scene.
 */
function animate() {
    renderer.setAnimationLoop(function() {
        const delta = clock.getDelta();
        
        // Update modules that require frame-by-frame updates
        playerController.update(delta, renderer.xr.getSession(), galleryMenu.isMenuVisible(), inVRConsole.visible); 
        artManager.update(galleryMenu.isMenuVisible());
        
        // The laser pointer only needs to be updated if the VR menu is visible
        if (galleryMenu.isMenuVisible() && renderer.xr.getSession()) {
            galleryMenu.updateLaserPointer();
        }

        // Render the scene
        renderer.render(scene, camera);
    });
}

/**
 * Handles window resize events to keep the viewport and camera aspect ratio in sync.
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
