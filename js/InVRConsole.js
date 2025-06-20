/**
 * A simple in-VR console to display log messages.
 */
export default class InVRConsole {
    /**
     * @param {THREE.Camera} camera The camera to attach the console to.
     * @param {number} maxLines The maximum number of lines to display.
     */
    constructor(camera, maxLines = 15) {
        this.camera = camera;
        this.maxLines = maxLines;
        this.logs = [];

        this.visible = false;
        
        // --- Scrolling State ---
        this.scrollX = 0;
        this.scrollY = 0;
        this.maxScrollX = 0;
        this.maxScrollY = 0;
        this.lineHeight = 32;
        this.padding = 10;

        // --- Setup 3D elements ---
        this.consoleGroup = new THREE.Group();
        this.consoleGroup.name = "InVRConsole";
        this.consoleGroup.position.set(0, -0.2, -1.5);

        this.canvas = document.createElement('canvas');
        this.canvas.width = 2048; // Increased width for horizontal scrolling
        this.canvas.height = 768;
        this.context = this.canvas.getContext('2d');

        const texture = new THREE.CanvasTexture(this.canvas);
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.75), material);
        this.consoleGroup.add(this.mesh);
        
        // Hide it initially
        this.hide();

        // --- Hijack console methods ---
        this.originalConsole = {
            log: console.log.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
        };

        console.log = this.log.bind(this, 'log');
        console.warn = this.log.bind(this, 'warn');
        console.error = this.log.bind(this, 'error');
        
        window.addEventListener('error', (event) => {
             this.log('error', `Uncaught: ${event.message}`);
        });
    }

    log(type, ...args) {
        // Log to the original console first
        this.originalConsole[type](...args);

        // Format and add to our internal log buffer
        const message = args.map(arg => {
            if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
            return arg;
        }).join(' ');

        this.logs.push({ type, message });
        if (this.logs.length > this.maxLines) {
            this.logs.shift();
        }
        this.updateTexture();
    }

    /**
     * Scrolls the console view.
     * @param {number} dx Change in X direction.
     * @param {number} dy Change in Y direction.
     */
    scroll(dx, dy) {
        this.scrollX += dx;
        this.scrollY += dy;

        // Clamp scroll values within bounds
        this.scrollX = Math.max(0, Math.min(this.scrollX, this.maxScrollX));
        this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScrollY));
        
        this.updateTexture();
    }
    
    updateTexture() {
        const ctx = this.context;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context and apply scrolling translation
        ctx.save();
        ctx.translate(-this.scrollX, -this.scrollY);

        // Text
        ctx.font = '28px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        let maxTextWidth = 0;

        this.logs.forEach((log, i) => {
            switch (log.type) {
                case 'warn':
                    ctx.fillStyle = 'yellow';
                    break;
                case 'error':
                    ctx.fillStyle = 'red';
                    break;
                default:
                    ctx.fillStyle = 'white';
                    break;
            }
            const lineText = `> ${log.message}`;
            const textMetric = ctx.measureText(lineText);
            if (textMetric.width > maxTextWidth) {
                maxTextWidth = textMetric.width;
            }
            ctx.fillText(lineText, this.padding, this.padding + (i * this.lineHeight));
        });

        // Restore context after drawing text
        ctx.restore();

        // Update scroll bounds
        this.maxScrollX = Math.max(0, maxTextWidth + this.padding * 2 - this.canvas.width);
        this.maxScrollY = Math.max(0, this.logs.length * this.lineHeight + this.padding * 2 - this.canvas.height);

        this.mesh.material.map.needsUpdate = true;
    }

    show() {
        if (this.visible) return;
        this.scrollX = 0; // Reset scroll on show
        this.scrollY = 0;
        this.updateTexture();
        this.camera.add(this.consoleGroup);
        this.visible = true;
    }

    hide() {
        if (!this.visible) return;
        this.camera.remove(this.consoleGroup);
        this.visible = false;
    }
    
    dispose() {
        // Restore original console functions
        console.log = this.originalConsole.log;
        console.warn = this.originalConsole.warn;
        console.error = this.originalConsole.error;
    }
}
