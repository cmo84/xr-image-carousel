/**
 * Creates and manages a simple text-based guide for WebXR controllers.
 */
export default class XRControllerGuide {
    /**
     * @param {THREE.Group} controllerGrip The controller grip to attach the guide to.
     */
    constructor(controllerGrip) {
        this.guidePanel = this._createGuidePanel();
        this.guidePanel.visible = false; // Start hidden
        
        // Position the panel relative to the controller
        this.guidePanel.position.set(0, 0.1, -0.05);
        this.guidePanel.rotation.x = -0.5;

        controllerGrip.add(this.guidePanel);
    }

    _createGuidePanel() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const canvasWidth = 1024;
        const canvasHeight = 768;
        const padding = 40;
        const lineHeight = 60;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Panel Background
        ctx.fillStyle = "rgba(20, 20, 20, 0.85)";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, canvasWidth, canvasHeight);
        
        // Text Styling
        ctx.fillStyle = "white";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const controls = [
            { title: 'Left Controller', font: 'bold 50px sans-serif', items: [
                'Thumbstick: Move / Turn / Scroll Menu',
                'Thumbstick Click: Open/Close Menu',
                'Trigger: Toggle Info / Select Menu Item',
                'Grip: Clutch Move',
                'X Button: Next Image',
                'Y Button: Previous Image',
            ]},
            { title: 'Right Controller', font: 'bold 50px sans-serif', items: [
                'A Button: Toggle In-VR Console',
                'Thumbstick: Scroll In-VR Console',
            ]}
        ];

        let yPos = padding;

        controls.forEach(controlSet => {
            // Draw Title
            ctx.font = controlSet.font;
            ctx.fillText(controlSet.title, padding, yPos);
            yPos += lineHeight * 1.2;

            // Draw Items
            ctx.font = '40px sans-serif';
            controlSet.items.forEach(item => {
                ctx.fillText(`• ${item}`, padding + 20, yPos);
                yPos += lineHeight;
            });
            yPos += lineHeight * 0.5; // Extra space between sections
        });


        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
        const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.375), material);
        
        return panelMesh;
    }

    show() {
        this.guidePanel.visible = true;
    }

    hide() {
        this.guidePanel.visible = false;
    }

    /**
     * This class does not require frame-by-frame updates.
     */
    update() {
        // No-op
    }
    
    /**
     * Disposes of the guide panel to clean up resources.
     */
    dispose() {
        if (this.guidePanel && this.guidePanel.parent) {
            this.guidePanel.parent.remove(this.guidePanel);
        }
        if(this.guidePanel.material.map) this.guidePanel.material.map.dispose();
        if(this.guidePanel.material) this.guidePanel.material.dispose();
        if(this.guidePanel.geometry) this.guidePanel.geometry.dispose();
    }
}
