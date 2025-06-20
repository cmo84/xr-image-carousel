/**
 * @file Manages the lifecycle and display of the 3D art gallery content.
 * This class handles fetching gallery data from manifest files, creating 3D meshes for each artwork,
 * arranging them in a circular layout, and managing informational overlays.
 */

/**
 * Manages all aspects of loading, displaying, and interacting with the gallery artwork.
 */
export default class ArtManager {
    /**
     * @param {THREE.Scene} scene - The main Three.js scene object.
     * @param {THREE.PerspectiveCamera} camera - The main camera.
     * @param {THREE.WebGLRenderer} renderer - The main Three.js renderer.
     * @param {THREE.TextureLoader} textureLoader - The loader for image textures.
     * @param {number} playerHeight - The height of the player, used for vertical positioning of art.
     */
    constructor(scene, camera, renderer, textureLoader, playerHeight) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.textureLoader = textureLoader;
        this.PLAYER_HEIGHT = playerHeight;

        // Group to hold all painting objects for easy manipulation
        this.artGroup = null;
        this.diagnosticLabels = [];
        this.totalPaintings = 0;
        this.galleryRadius = 10;
        this.MAX_PAINTING_HEIGHT = 2.5;
        this.targetImageIndex = 0;
        this.targetQuaternion = new THREE.Quaternion();
        this.diagnosticMode = false;
    }

    /**
     * Returns the configured radius of the gallery circle.
     * @returns {number} The gallery radius.
     */
    getGalleryRadius() {
        return this.galleryRadius;
    }

    /**
     * Selects the next image in the gallery sequence.
     */
    selectNextImage() {
        if (this.totalPaintings > 0) {
            this.targetImageIndex = (this.targetImageIndex + 1) % this.totalPaintings;
        }
    }

    /**
     * Selects the previous image in the gallery sequence.
     */
    selectPreviousImage() {
        if (this.totalPaintings > 0) {
            this.targetImageIndex = (this.targetImageIndex - 1 + this.totalPaintings) % this.totalPaintings;
        }
    }

    /**
     * Toggles the visibility of diagnostic information labels on the paintings.
     */
    toggleDiagnosticMode() {
        this.diagnosticMode = !this.diagnosticMode;
    }

    /**
     * Per-frame update logic for the ArtManager.
     * Handles the smooth rotation of the gallery and updates diagnostic label visibility.
     * @param {boolean} isMenuVisible - Whether the main menu is currently visible.
     */
    update(isMenuVisible) {
        // Smoothly rotate the entire gallery to face the target image, but only if the menu is hidden.
        if (this.artGroup && !isMenuVisible && this.totalPaintings > 0) {
            const targetAngle = (this.targetImageIndex / this.totalPaintings) * Math.PI * 2;
            this.targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
            this.artGroup.quaternion.slerp(this.targetQuaternion, 0.05);
        }
        
        // Animate diagnostic labels appearing/disappearing.
        this.diagnosticLabels.forEach(label => {
            const targetY = this.diagnosticMode ? label.userData.visibleY : label.userData.hiddenY;
            if (this.diagnosticMode) {
                label.visible = true; 
            }
            label.position.y = THREE.MathUtils.lerp(label.position.y, targetY, 0.1);
            // Hide the label completely once it has animated out of view to save resources.
            if (!this.diagnosticMode && Math.abs(label.position.y - targetY) < 0.001) {
                label.visible = false;
            }
        });
    }

    /**
     * Resets the gallery to its initial state, clearing any existing artwork.
     */
    resetGallery() {
        // Remove any existing messages from the camera view
        const emptyMessage = this.camera.getObjectByName("emptyGalleryMessage");
        if (emptyMessage) { this.camera.remove(emptyMessage); }
        const welcomeMessage = this.camera.getObjectByName("welcomeMessage");
        if (welcomeMessage) { this.camera.remove(welcomeMessage); }

        this.targetImageIndex = 1;
        
        // Remove the entire art group from the scene
        if (this.artGroup) {
            this.scene.remove(this.artGroup);
        }
        
        // Re-initialize containers
        this.diagnosticLabels = [];
        this.artGroup = new THREE.Group();
        this.artGroup.name = "ArtGroup"; // Assign the name the menu system looks for.
        this.scene.add(this.artGroup);

        // Re-create the paintings based on the current URL
        this.createPaintings();
    }

    /**
     * Creates the paintings for the current gallery based on the 'f' URL parameter.
     */
    createPaintings() {
        const urlParams = new URLSearchParams(window.location.search);
        const folderName = urlParams.get('f');

        // If no folder is specified, show the welcome message.
        if (!folderName) {
            this.displayWelcomeMessage();
            return;
        }

        const manifestUrl = `images/${folderName}/manifest.json`;
        fetch(manifestUrl)
            .then(response => {
                if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                return response.json();
            })
            .then(manifest => {
                const imageFiles = manifest.images;
                imageFiles.reverse(); // Reverse image order for intuitive navigation
                this.totalPaintings = imageFiles.length; 

                if (this.totalPaintings === 0) {
                    this.displayEmptyGalleryMessage();
                    return;
                }
                
                // Calculate the maximum width for each painting to fit in the circle without overlapping.
                const circumference = 2 * Math.PI * this.galleryRadius;
                const gap = 0.5;
                const maxPaintingWidth = (circumference / this.totalPaintings) - gap;

                imageFiles.forEach((filename, i) => {
                    const paintingGroup = new THREE.Group();
                    const angle = (i / this.totalPaintings) * Math.PI * 2;
                    const xPos = Math.sin(angle) * this.galleryRadius;
                    const zPos = Math.cos(angle) * this.galleryRadius;
                    const yPos = this.PLAYER_HEIGHT + 0.3;

                    paintingGroup.position.set(xPos, yPos, zPos);
                    // Rotate the painting to face the center of the gallery
                    paintingGroup.rotation.y = angle + Math.PI;
                    
                    this.artGroup.add(paintingGroup);

                    const imageUrl = `images/${folderName}/${filename}`;
                    this.textureLoader.load(
                        imageUrl,
                        (texture) => {
                            // Calculate the painting's dimensions while maintaining aspect ratio.
                            const aspectRatio = texture.image.naturalWidth / texture.image.naturalHeight;
                            let finalHeight = this.MAX_PAINTING_HEIGHT;
                            let finalWidth = finalHeight * aspectRatio;

                            // If the calculated width is too large, constrain it and adjust height accordingly.
                            if (finalWidth > maxPaintingWidth) {
                                finalWidth = maxPaintingWidth;
                                finalHeight = finalWidth / aspectRatio;
                            }

                            const painting = new THREE.Mesh(new THREE.PlaneGeometry(finalWidth, finalHeight), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
                            paintingGroup.add(painting);

                            this.createDiagnosticLabel(paintingGroup, filename, folderName, texture.image, finalWidth, finalHeight);
                        },
                        undefined, // onProgress callback
                        (error) => { console.error(`Could not load painting: ${imageUrl}`); }
                    );
                });
            })
            .catch(error => {
                console.error('Failed to create gallery:', error);
                this.displayEmptyGalleryMessage(); 
            });
    }

    /**
     * Displays a message indicating that the current gallery is empty.
     */
    displayEmptyGalleryMessage() {
        if (this.camera.getObjectByName("emptyGalleryMessage")) return;

        const messageGroup = new THREE.Group();
        messageGroup.name = "emptyGalleryMessage";

        const textCanvas = document.createElement('canvas');
        textCanvas.width = 1024;
        textCanvas.height = 256;
        const context = textCanvas.getContext('2d');
        context.fillStyle = '#111';
        context.fillRect(0, 0, 1024, 256);
        context.strokeStyle = '#555';
        context.lineWidth = 10;
        context.strokeRect(0, 0, 1024, 256);
        context.fillStyle = 'white';
        context.font = '60px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText("This gallery contains no images.", 512, 128);

        const texture = new THREE.CanvasTexture(textCanvas);
        const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), material);

        messageGroup.add(plane);
        // Attach message to the camera so it's always in view.
        messageGroup.position.set(0, 0, -2.5);
        this.camera.add(messageGroup);
    }

    /**
     * Displays a welcome message with control instructions.
     */
    displayWelcomeMessage() {
        const messageGroup = new THREE.Group();
        messageGroup.name = "welcomeMessage";

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        // Check if currently in a VR session to adjust the message content
        const isVR = this.renderer.xr.isPresenting;

        canvas.width = isVR ? 1200 : 1024;
        canvas.height = isVR ? 800 : 600;

        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';

        ctx.font = 'bold 72px sans-serif';
        ctx.fillText('Welcome!', canvas.width / 2, 100);

        if (isVR) {
            // VR-specific controls
            ctx.font = '48px sans-serif';
            ctx.fillText("Use your controllers to navigate", canvas.width / 2, 200);

            const cx = canvas.width / 2;
            ctx.textAlign = 'left';
            ctx.font = 'bold 38px sans-serif';
            ctx.fillText("Left Controller", cx - 450, 300);
            ctx.fillText("Right Controller", cx + 150, 300);

            ctx.font = '32px sans-serif';
            ctx.fillText("• Thumbstick: Move / Turn / Scroll", cx - 450, 360);
            ctx.fillText("• Thumbstick Click: Open Menu", cx - 450, 410);
            ctx.fillText("• Trigger: Toggle Info & Select Menu", cx - 450, 460);
            ctx.fillText("• Grip: Clutch Move", cx - 450, 510);
            ctx.fillText("• X Button: Next Image", cx - 450, 560);
            ctx.fillText("• Y Button: Previous Image", cx - 450, 610);
            
            ctx.fillText("• A Button: Toggle Console", cx + 150, 360);
            ctx.fillText("• B Button: Toggle Controller Info", cx + 150, 410);
            ctx.fillText("• Thumbstick: Scroll Console", cx + 150, 460);


            ctx.textAlign = 'center';
            ctx.font = 'bold 42px sans-serif';
            ctx.fillText("Press JOYSTICK CLICK to open the gallery menu", canvas.width / 2, 720);
            
        } else {
            // Desktop-specific controls
            ctx.font = '42px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("Press 'M' to open the gallery menu", canvas.width / 2, 200);

            ctx.font = 'bold 36px sans-serif';
            ctx.fillText("Navigation", canvas.width / 4, 300);
            ctx.fillText("Gallery", canvas.width * 0.75, 300);

            ctx.font = '32px sans-serif';
            ctx.fillText("W/S: Move Fwd/Back", canvas.width / 4, 360);
            ctx.fillText("A/D: Turn Left/Right", canvas.width / 4, 410);
            ctx.fillText("Q/E: Strafe Left/Right", canvas.width / 4, 460);
            ctx.fillText("R/F: Move Up/Down", canvas.width / 4, 510);
            
            ctx.fillText("'.': Next Image", canvas.width * 0.75, 360);
            ctx.fillText("',': Previous Image", canvas.width * 0.75, 410);
            ctx.fillText("'I': Toggle Info", canvas.width * 0.75, 460);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const planeWidth = isVR ? 2.4 : 1.8;
        const planeHeight = isVR ? 1.6 : 1.05;
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeHeight), material);

        messageGroup.add(plane);
        // Attach message to the camera so it's always in view.
        messageGroup.position.set(0, isVR ? 0.2 : 0, -2.5);
        this.camera.add(messageGroup);
    }
    
    /**
     * Creates a diagnostic label for a single painting.
     * @param {THREE.Group} parent - The parent group (the painting group) to attach the label to.
     * @param {string} filename - The filename of the image.
     * @param {string} folderName - The name of the gallery folder.
     * @param {HTMLImageElement} image - The loaded image element to get dimensions from.
     * @param {number} paintingWidth - The final width of the painting mesh.
     * @param {number} paintingHeight - The final height of the painting mesh.
     */
    createDiagnosticLabel(parent, filename, folderName, image, paintingWidth, paintingHeight) {
        const labelGroup = new THREE.Group();
        const fullText = `${folderName}/${filename} - ${image.naturalWidth}x${image.naturalHeight}`;
        
        const fontSize = 40;
        const lineHeight = 50;
        const padding = 20;
        const maxWidth = 1800; // Max width before wrapping

        const textCanvas = document.createElement('canvas');
        const context = textCanvas.getContext('2d');
        context.font = `${fontSize}px sans-serif`;

        // --- Hierarchical Text Wrapping Logic ---
        function wrapText(text, ctx, maxWidth) {
            const lines = [];
            let remainingText = text;

            while (remainingText.length > 0) {
                let endIndex = remainingText.length;
                while (ctx.measureText(remainingText.substring(0, endIndex)).width > maxWidth && endIndex > 0) {
                    endIndex--;
                }

                if (endIndex === 0) endIndex = 1; // Failsafe for single chars that are too wide

                let breakPoint = endIndex;
                const potentialLine = remainingText.substring(0, endIndex);
                
                // If the entire remaining text fits, we are done with this segment
                if (endIndex === remainingText.length) {
                    lines.push(remainingText);
                    break;
                }

                const lastSlash = potentialLine.lastIndexOf('/');
                const lastUnderscore = potentialLine.lastIndexOf('_');
                const lastSpace = potentialLine.lastIndexOf(' ');

                // Find the best break point with slash > underscore > space hierarchy
                let bestBreak = -1;
                if (lastSlash > 0) bestBreak = lastSlash + 1;
                else if (lastUnderscore > 0) bestBreak = lastUnderscore + 1;
                else if (lastSpace > 0) bestBreak = lastSpace + 1;

                if (bestBreak > 0) {
                    breakPoint = bestBreak;
                }
                
                lines.push(remainingText.substring(0, breakPoint).trim());
                remainingText = remainingText.substring(breakPoint).trim();
            }
            return lines;
        }

        const lines = wrapText(fullText, context, maxWidth);
        // --- End Text Wrapping ---

        let actualTextWidth = 0;
        lines.forEach(line => {
            actualTextWidth = Math.max(actualTextWidth, context.measureText(line).width);
        });

        const canvasWidth = actualTextWidth;
        const canvasHeight = lines.length * lineHeight;

        textCanvas.width = canvasWidth + padding * 2;
        textCanvas.height = canvasHeight + padding * 2;
        
        // Redraw with final dimensions
        context.font = `${fontSize}px sans-serif`;
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'top';

        for(let i = 0; i < lines.length; i++) {
            context.fillText(lines[i], textCanvas.width / 2, padding + (i * lineHeight));
        }

        const texture = new THREE.CanvasTexture(textCanvas);
        const textMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        
        const scaleFactor = 0.001;
        const textPlaneWidth = textCanvas.width * scaleFactor;
        const textPlaneHeight = textCanvas.height * scaleFactor;
        const textMesh = new THREE.Mesh(new THREE.PlaneGeometry(textPlaneWidth, textPlaneHeight), textMaterial);

        // Create a background panel that matches the new dynamic size
        const panel = new THREE.Mesh(
            new THREE.PlaneGeometry(textPlaneWidth, textPlaneHeight),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 })
        );

        panel.position.z = -0.01; // Place panel slightly behind the text
        labelGroup.add(panel);
        labelGroup.add(textMesh);
        
        // Adjust Y positions based on the new dynamic height
        labelGroup.userData.hiddenY = paintingHeight / 2;
        labelGroup.userData.visibleY = (paintingHeight / 2) + (textPlaneHeight / 2) + 0.05; 
        labelGroup.position.y = labelGroup.userData.hiddenY;
        
        labelGroup.visible = false; // Start invisible

        parent.add(labelGroup);
        this.diagnosticLabels.push(labelGroup);
    }
}
