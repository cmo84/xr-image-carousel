/**
 * @file Manages the gallery selection menu in both 2D (HTML) and 3D (VR) modes.
 * This class handles fetching the list of available galleries, rendering the menu,
 * and processing user interactions for gallery selection.
 */

/**
 * Encapsulates the state and behavior of the gallery selection menu.
 */
export default class GalleryMenu {
    /**
     * @param {THREE.PerspectiveCamera} camera - The main camera, used to attach the VR menu.
     * @param {THREE.WebGLRenderer} renderer - The main Three.js renderer.
     * @param {THREE.XRTargetRaySpace} controller1 - The controller used for pointing and selecting in VR.
     * @param {function} onGalleryLoadCallback - A callback function to execute when a new gallery is selected.
     */
    constructor(camera, renderer, controller1, onGalleryLoadCallback) {
        this.camera = camera;
        this.renderer = renderer;
        this.controller1 = controller1;
        this.onGalleryLoadCallback = onGalleryLoadCallback;

        this.raycaster = new THREE.Raycaster();
        this.laserPointer = null;

        // --- DOM Elements for the 2D menu ---
        this.menuElement = document.getElementById('menu');
        this.galleryListElement = document.getElementById('gallery-list');
        
        // --- Menu State ---
        this.galleries = [];
        this.selectedGalleryIndex = -1;
        this.menuVisible = false;

        // --- VR Menu State and Parameters ---
        this.vrMenuScrollGroup = null;
        this.vrMenuScrollPosition = 0;
        this.vrMenuScrollBounds = { min: 0, max: 0 };
        this.VR_MENU_HEIGHT = 1.0; 
        this.VR_MENU_ITEM_HEIGHT = 0.11;

        this._setupLaserPointer();
        this.loadGalleries();
    }

    /**
     * Creates the laser pointer mesh and attaches it to the controller.
     * @private
     */
    _setupLaserPointer() {
        const laserGeometry = new THREE.BufferGeometry().setFromPoints([ new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5) ]);
        const laserMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
        this.laserPointer = new THREE.Line(laserGeometry, laserMaterial);
        this.laserPointer.visible = false;
        this.controller1.add(this.laserPointer);
    }

    /**
     * Checks if the menu is currently visible.
     * @returns {boolean} True if the menu is visible.
     */
    isMenuVisible() {
        return this.menuVisible;
    }

    /**
     * Triggers the loading of the currently highlighted gallery.
     */
    selectCurrentItem() {
        if (this.menuVisible && this.selectedGalleryIndex !== -1) {
            this.loadGallery(this.galleries[this.selectedGalleryIndex]);
        }
    }

    /**
     * Fetches the list of galleries from `galleries.json`.
     */
    loadGalleries() {
        fetch('galleries.json')
            .then(response => response.json())
            .then(data => {
                // Ensure that galleries is always an array, even if the JSON provides a single string.
                this.galleries = Array.isArray(data.galleries) ? data.galleries : [data.galleries];

                // Sort galleries numerically if they have numbers in their names.
                if (this.galleries.length > 1) { // Sorting is only necessary for more than one item
                    this.galleries.sort((a, b) => {
                        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
                    });
                }
                this.renderMenu();
            })
            .catch(error => console.error('Error loading galleries:', error));
    }

    /**
     * Renders the 2D HTML list of galleries.
     */
    renderMenu() {
        this.galleryListElement.innerHTML = '';
        this.galleries.forEach((galleryName, index) => {
            const li = document.createElement('li');
            li.textContent = galleryName;
            li.dataset.index = index;
            li.addEventListener('click', () => { this.loadGallery(galleryName); });
            this.galleryListElement.appendChild(li);
        });
    }

    /**
     * Loads a selected gallery by updating the URL and triggering a reset.
     * @param {string} galleryName - The name of the gallery folder to load.
     */
    loadGallery(galleryName) {
        const url = new URL(window.location);
        url.searchParams.set('f', galleryName);
        window.history.pushState({}, '', url);
        this.hideMenu();
        if (this.onGalleryLoadCallback) {
            this.onGalleryLoadCallback();
        }
    }

    /**
     * Toggles the visibility of the menu.
     */
    toggleMenu() {
        this.menuVisible = !this.menuVisible;
        if (this.menuVisible) this.showMenu();
        else this.hideMenu();
    }

    /**
     * Shows the menu, displaying either the 2D or 3D version based on the XR session state.
     */
    showMenu() {
        const artGroup = this.camera.parent.parent.getObjectByName('ArtGroup');
        if (artGroup) artGroup.visible = false; // Hide art while menu is open

        this.menuVisible = true;
        const isPresenting = this.renderer.xr.isPresenting;

        if (isPresenting) {
            this.laserPointer.visible = true;
            this.createVRMenu();
        } else {
            this.menuElement.style.display = 'block';
        }
    }

    /**
     * Hides the menu.
     */
    hideMenu() {
        const artGroup = this.camera.parent.parent.getObjectByName('ArtGroup');
        if(artGroup) artGroup.visible = true; // Show art again

        this.menuVisible = false;
        this.laserPointer.visible = false;
        this.menuElement.style.display = 'none';

        // Clean up the VR menu if it exists
        const vrMenu = this.camera.getObjectByName("VRMenu");
        if (vrMenu) {
            this.camera.remove(vrMenu);
        }
        this.vrMenuScrollGroup = null;
    }
    
    /**
     * Updates the laser pointer's raycasting for VR menu interaction.
     */
    updateLaserPointer() {
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(this.controller1.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(this.controller1.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

        const vrMenu = this.camera.getObjectByName("VRMenu");
        if (vrMenu && this.vrMenuScrollGroup) {
            // Reset colors
            this.vrMenuScrollGroup.children.forEach(child => {
                if (child.isMesh) child.material.color.set(0xffffff);
            }); 
            
            const intersects = this.raycaster.intersectObjects(this.vrMenuScrollGroup.children, true);
            
            // If intersecting, highlight the item and update the selected index.
            if (intersects.length > 0) {
                const intersectedObject = intersects[0].object;
                if (intersectedObject.isMesh) {
                   intersectedObject.material.color.set(0x00ff00);
                   this.selectedGalleryIndex = this.galleries.indexOf(intersectedObject.userData.galleryName);
                }
            } else {
                this.selectedGalleryIndex = -1;
            }
        }
    }

    /**
     * Scrolls the VR menu based on thumbstick input.
     * @param {number} scrollAmount - The amount to scroll, derived from controller input.
     */
    scrollVRMenu(scrollAmount) {
        if (!this.vrMenuScrollGroup) return;

        const scrollSpeed = 1.0; 
        this.vrMenuScrollPosition += scrollAmount * scrollSpeed;
        // Clamp scroll position within calculated bounds
        this.vrMenuScrollPosition = Math.max(this.vrMenuScrollBounds.min, Math.min(this.vrMenuScrollBounds.max, this.vrMenuScrollPosition));
        this.vrMenuScrollGroup.position.y = this.vrMenuScrollPosition;
    }
    
    /**
     * Creates the 3D VR menu and attaches it to the camera.
     */
    createVRMenu() {
        if (this.camera.getObjectByName("VRMenu")) return;

        const menuGroup = new THREE.Group();
        menuGroup.name = "VRMenu";
        
        const totalContentHeight = this.galleries.length * this.VR_MENU_ITEM_HEIGHT;
        
        // Create the background panel
        const backgroundPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(1.2, this.VR_MENU_HEIGHT),
            new THREE.MeshBasicMaterial({ color: 0x151515, opacity: 0.8, transparent: true, side: THREE.DoubleSide })
        );
        backgroundPlane.position.z = -0.01;
        menuGroup.add(backgroundPlane);

        // This group will contain all the menu items and will be scrolled vertically
        this.vrMenuScrollGroup = new THREE.Group();
        menuGroup.add(this.vrMenuScrollGroup);

        // Create a mesh for each gallery name
        this.galleries.forEach((name, i) => {
            const textCanvas = document.createElement('canvas');
            textCanvas.width = 512; textCanvas.height = 64;
            const textCtx = textCanvas.getContext('2d');
            textCtx.fillStyle = 'white'; textCtx.font = '32px sans-serif';
            textCtx.textAlign = 'center';
            textCtx.textBaseline = 'middle';
            textCtx.fillText(name, 256, 32);
            
            const texture = new THREE.CanvasTexture(textCanvas);
            const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
            const textMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.1), material);
            
            textMesh.position.y = (totalContentHeight / 2) - (i * this.VR_MENU_ITEM_HEIGHT) - (this.VR_MENU_ITEM_HEIGHT / 2);
            textMesh.userData.galleryName = name;
            this.vrMenuScrollGroup.add(textMesh);
        });

        // Calculate scroll bounds
        this.vrMenuScrollPosition = 0;
        const halfVisibleHeight = this.VR_MENU_HEIGHT / 2;
        const halfContentHeight = totalContentHeight / 2;
        this.vrMenuScrollBounds.max = Math.max(0, halfContentHeight - halfVisibleHeight);
        this.vrMenuScrollBounds.min = -this.vrMenuScrollBounds.max;
        this.vrMenuScrollGroup.position.y = this.vrMenuScrollPosition;
        
        // Position the entire menu in front of the camera
        menuGroup.position.set(0, 0, -2);
        
        this.camera.add(menuGroup);
    }
}
