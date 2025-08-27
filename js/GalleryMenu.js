/**
 * @file Manages the gallery selection menu in both 2D (HTML) and 3D (VR) modes.
 * v2.0 - Implements a two-level alphabetical navigation system.
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
        this.menuElement = document.getElementById('menu');
        this.galleryListElement = document.getElementById('gallery-list');
        
        // --- Menu State ---
        this.galleries = [];
        this.galleryData = {}; // For grouping galleries by first letter
        this.menuLevel = 'letters'; // Current view: 'letters' or 'galleries'
        this.currentLetter = null; // The currently selected letter
        this.selectedItemData = null; // Holds userData of the currently highlighted item
        this.menuVisible = false;

        // --- VR Menu State ---
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
     * Handles selection based on the current menu level and highlighted item.
     * It can navigate deeper into the menu, go back, or load a gallery.
     */
    selectCurrentItem() {
        if (!this.menuVisible || !this.selectedItemData) return;

        if (this.selectedItemData.isLetter) {
            this.menuLevel = 'galleries';
            this.currentLetter = this.selectedItemData.letter;
            this.refreshMenu(); // Re-render the menu to show galleries
        } else if (this.selectedItemData.galleryName) {
            this.loadGallery(this.selectedItemData.galleryName);
        } else if (this.selectedItemData.isBack) {
            this.menuLevel = 'letters';
            this.currentLetter = null;
            this.refreshMenu(); // Re-render the menu to show letters
        }
    }
    
    /**
     * Fetches the list of galleries from `galleries.json` and groups them alphabetically.
     */
    loadGalleries() {
        fetch('galleries.json')
            .then(response => response.json())
            .then(data => {
                this.galleries = Array.isArray(data.galleries) ? data.galleries : [data.galleries];
                this.galleries.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

                // Group galleries by their first letter
                this.galleryData = {};
                this.galleries.forEach(galleryName => {
                    const firstLetter = galleryName.charAt(0).toUpperCase();
                    if (!this.galleryData[firstLetter]) {
                        this.galleryData[firstLetter] = [];
                    }
                    this.galleryData[firstLetter].push(galleryName);
                });

                this.renderMenu();
            })
            .catch(error => console.error('Error loading galleries:', error));
    }

    /**
     * Renders the 2D HTML list of galleries, handling the two-level navigation.
     */
    renderMenu() {
        this.galleryListElement.innerHTML = '';

        if (this.menuLevel === 'letters') {
            document.querySelector('#menu h2').textContent = 'Select a Category';
            const letters = Object.keys(this.galleryData).sort();
            letters.forEach(letter => {
                const li = document.createElement('li');
                li.textContent = letter;
                li.addEventListener('click', () => {
                    this.menuLevel = 'galleries';
                    this.currentLetter = letter;
                    this.renderMenu();
                });
                this.galleryListElement.appendChild(li);
            });
        } else if (this.menuLevel === 'galleries') {
            document.querySelector('#menu h2').textContent = `Category: ${this.currentLetter}`;
            // Add a "Back" button
            const backLi = document.createElement('li');
            backLi.textContent = '< Back';
            backLi.style.fontWeight = 'bold';
            backLi.style.color = '#87CEFA';
            backLi.addEventListener('click', () => {
                this.menuLevel = 'letters';
                this.currentLetter = null;
                this.renderMenu();
            });
            this.galleryListElement.appendChild(backLi);

            const galleries = this.galleryData[this.currentLetter];
            galleries.forEach(galleryName => {
                const li = document.createElement('li');
                li.textContent = galleryName;
                li.addEventListener('click', () => this.loadGallery(galleryName));
                this.galleryListElement.appendChild(li);
            });
        }
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
        if (artGroup) artGroup.visible = false;
        this.menuVisible = true;
        this.refreshMenu();
    }

    /**
     * Hides the menu and resets its state to the top level.
     */
    hideMenu() {
        const artGroup = this.camera.parent.parent.getObjectByName('ArtGroup');
        if (artGroup) artGroup.visible = true;

        this.menuVisible = false;
        this.laserPointer.visible = false;
        this.menuElement.style.display = 'none';

        const vrMenu = this.camera.getObjectByName("VRMenu");
        if (vrMenu) this.camera.remove(vrMenu);
        
        // Reset to top level when menu is closed
        this.menuLevel = 'letters';
        this.currentLetter = null;
        this.vrMenuScrollGroup = null;
    }

    /**
     * Rerenders the menu, choosing the correct mode (2D or VR).
     * @private
     */
    refreshMenu() {
        const isPresenting = this.renderer.xr.isPresenting;
        if (isPresenting) {
            const oldMenu = this.camera.getObjectByName("VRMenu");
            if (oldMenu) this.camera.remove(oldMenu);
            this.laserPointer.visible = true;
            this.createVRMenu();
        } else {
            this.menuElement.style.display = 'block';
            this.renderMenu();
        }
    }
    
    /**
     * Updates the laser pointer's raycasting for VR menu interaction.
     */
    updateLaserPointer() {
        if (!this.vrMenuScrollGroup) return;

        const tempMatrix = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(this.controller1.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(this.controller1.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

        this.vrMenuScrollGroup.children.forEach(child => {
            if (child.isMesh) child.material.color.set(child.userData.isBack ? 0x87CEFA : 0xffffff);
        });
        
        const intersects = this.raycaster.intersectObjects(this.vrMenuScrollGroup.children, true);
        const intersectedObject = intersects.length > 0 ? intersects[0].object : null;

        if (intersectedObject && intersectedObject.isMesh) {
            intersectedObject.material.color.set(0x00ff00);
            this.selectedItemData = intersectedObject.userData;
        } else {
            this.selectedItemData = null;
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
        this.vrMenuScrollPosition = Math.max(this.vrMenuScrollBounds.min, Math.min(this.vrMenuScrollBounds.max, this.vrMenuScrollPosition));
        this.vrMenuScrollGroup.position.y = this.vrMenuScrollPosition;
    }
    
    /**
     * Creates the 3D VR menu and attaches it to the camera, rendering the correct level.
     */
    createVRMenu() {
        const menuGroup = new THREE.Group();
        menuGroup.name = "VRMenu";
        this.vrMenuScrollGroup = new THREE.Group();
        menuGroup.add(this.vrMenuScrollGroup);

        const itemsToRender = [];
        if (this.menuLevel === 'letters') {
            const letters = Object.keys(this.galleryData).sort();
            letters.forEach(letter => itemsToRender.push({ text: letter, data: { isLetter: true, letter: letter } }));
        } else if (this.menuLevel === 'galleries') {
            itemsToRender.push({ text: '< Back', data: { isBack: true }, color: 0x87CEFA });
            const galleries = this.galleryData[this.currentLetter];
            galleries.forEach(name => itemsToRender.push({ text: name, data: { galleryName: name } }));
        }

        const totalContentHeight = itemsToRender.length * this.VR_MENU_ITEM_HEIGHT;
        let currentY = totalContentHeight / 2;

        itemsToRender.forEach(item => {
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = item.color ? `#${item.color.toString(16).padStart(6, '0')}` : 'white';
            ctx.font = 'bold 32px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(item.text, 256, 32);
            
            const material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.1), material);
            mesh.userData = item.data;
            
            currentY -= this.VR_MENU_ITEM_HEIGHT / 2;
            mesh.position.y = currentY;
            currentY -= this.VR_MENU_ITEM_HEIGHT / 2;
            this.vrMenuScrollGroup.add(mesh);
        });

        const backgroundPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(1.2, this.VR_MENU_HEIGHT),
            new THREE.MeshBasicMaterial({ color: 0x151515, opacity: 0.8, transparent: true })
        );
        backgroundPlane.position.z = -0.01;
        menuGroup.add(backgroundPlane);

        this.vrMenuScrollPosition = 0;
        const halfVisibleHeight = this.VR_MENU_HEIGHT / 2;
        const halfContentHeight = totalContentHeight / 2;
        this.vrMenuScrollBounds.max = Math.max(0, halfContentHeight - halfVisibleHeight);
        this.vrMenuScrollBounds.min = -this.vrMenuScrollBounds.max;
        this.vrMenuScrollGroup.position.y = this.vrMenuScrollPosition;
        
        menuGroup.position.set(0, 0, -2);
        this.camera.add(menuGroup);
    }
}