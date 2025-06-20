/**
 * @file A self-contained factory object for creating WebXR UI buttons.
 * It handles the logic for checking browser support for 'immersive-vr' and 'immersive-ar' sessions
 * and provides buttons to initiate these sessions.
 */

// --- WebXR Button Factory ---
const WebXRButton = {
    /**
     * Creates a container with AR and VR entry buttons.
     * @param {THREE.WebGLRenderer} renderer - The active Three.js renderer.
     * @returns {HTMLDivElement} A div element containing the WebXR buttons.
     */
    createButton: function(renderer) {
        const container = document.createElement('div');
        container.id = 'xr-button-container';
        let currentSession = null;

        /**
         * Called when a WebXR session is successfully started.
         * @param {XRSession} session - The newly started WebXR session.
         */
        function onSessionStarted(session) {
            session.addEventListener('end', onSessionEnded);
            renderer.xr.setSession(session);
            currentSession = session;
            // Hide buttons when in an XR session
            container.style.display = 'none';
        }

        /**
         * Called when the WebXR session has ended.
         */
        function onSessionEnded() {
            currentSession.removeEventListener('end', onSessionEnded);
            currentSession = null;
            // Show buttons again when the session ends
            container.style.display = 'flex';
        }

        // Check if the browser supports WebXR
        if ('xr' in navigator) {
            // --- VR Button ---
            const vrButton = document.createElement('button');
            vrButton.className = 'xr-button';
            vrButton.textContent = 'ENTER VR';
            vrButton.disabled = true; // Disabled until support is confirmed
            navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
                vrButton.disabled = !supported;
                if (supported) {
                    vrButton.onclick = () => {
                        const sessionInit = { optionalFeatures: ['local-floor', 'bounded-floor'] };
                        navigator.xr.requestSession('immersive-vr', sessionInit).then(onSessionStarted);
                    };
                }
            });
            container.appendChild(vrButton);

            // --- AR Button ---
            const arButton = document.createElement('button');
            arButton.className = 'xr-button';
            arButton.textContent = 'ENTER AR';
            arButton.disabled = true; // Disabled until support is confirmed
            navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
                arButton.disabled = !supported;
                if (supported) {
                    arButton.onclick = () => {
                        const sessionInit = { 
                            optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'dom-overlay'], 
                            domOverlay: { root: document.body } 
                        };
                        navigator.xr.requestSession('immersive-ar', sessionInit).then(onSessionStarted);
                    };
                }
            });
            container.appendChild(arButton);
        } else {
            // If WebXR is not supported, provide a link to learn more.
            const message = document.createElement('a');
            message.href = 'https://immersiveweb.dev/';
            message.innerHTML = 'WEBXR NOT AVAILABLE';
            message.style.color = 'white';
            container.appendChild(message);
        }
        return container;
    }
};

export default WebXRButton;
