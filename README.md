# **xr-image-carousel**

# **A WebXR Floating Image Gallery**

This project is a fully immersive, 3D image gallery viewer designed for WebXR-compatible devices. It allows users to explore collections of images in a virtual space using either a VR headset for a fully opaque experience or an AR-capable device for a mixed-reality overlay with default controls provided for the Meta Quest 3\.

The application is built with a modular architecture and comes with a suite of utility scripts for easy content management and local deployment on Windows.

## **Tech Stack**

* **3D Engine:** [Three.js](https://threejs.org/)  
* **XR API:** [WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API)  
* **Core Language:** JavaScript (ES6 Modules)  
* **Local Server:** Node.js with the http-server package  
* **Tooling:** Windows Batch Scripts for automation, PowerShell for archive and JSON handling, and OpenSSL for security (for AR mode).

## **Project Structure**

The project is organized into a clean, modular structure:

* /index.html: The main entry point of the web application.  
* /style.css: Contains all the styling for the 2D HTML elements.  
* /images/: The directory where all gallery content is stored.  
* /js/: Contains the modular JavaScript source code.  
  * main.js: The central orchestrator that initializes the app and all other modules.  
  * ArtManager.js: Manages loading, creating, and displaying the 3D artwork.  
  * PlayerController.js: Handles all user input for both desktop and XR navigation.  
  * GalleryMenu.js: Controls the 2D and 3D gallery selection menus.  
  * WebXRButton.js: Creates the "Enter VR/AR" UI buttons.  
  * XRControllerGuide.js & InVRConsole.js: Utility modules for in-VR help and debugging.  
* \*.bat: A collection of batch scripts for managing content and running the server.

## **How-To Guide: Managing Gallery Content**

The gallery content is managed through a semi-automated workflow using the provided .bat scripts. The primary method is to create galleries from .zip archives.

### **Step 1: Add Your Images**

1. Gather the images for each gallery you want to create.  
2. Compress each collection into its own .zip file (e.g., My Vacation Photos.zip, Art-Collection.zip).  
3. Place all of these .zip files into the /images folder at the root of the project.

### **Step 2: Unzip Archives and Create Manifests**

Run the unzip\_and\_manifest.bat script by double-clicking it. This script will:

1. Scan the /images folder for any .zip files.  
2. For each archive, it creates a new folder with the same name (e.g., My Vacation Photos.zip \-\> /images/My Vacation Photos/).  
3. It extracts all the contents of the zip file into this new folder.  
4. Finally, it scans the new folder for image files (.jpg, .png, etc.) and automatically generates a manifest.json file inside it. This manifest file lists all the images for the gallery.

### **Step 3: Update the Master Gallery List**

After creating your gallery folders, run the update\_galleries.bat script. This script scans all the subfolders within /images. If it finds a folder that contains a manifest.json, it considers it a valid gallery and adds its name to the master galleries.json file in the root directory. The application reads this master file to populate the gallery selection menu.

### **Manual Manifest Creation**

If you have an existing folder of images that is not zipped, you can use the manifest.bat utility. Simply copy or move manifest.bat into your image folder and double-click it. It will generate a manifest.json file in that specific folder. After doing this, you still need to run update\_galleries.bat from the root directory to make the application aware of the new gallery.

## **Running the Application**

The project includes two scripts for running a local web server, tailored for either VR or AR testing. These scripts include a one-time setup process that automatically downloads a portable version of Node.js and installs the necessary http-server package. You will be prompted to approve this setup the first time you run either script.

### **For VR (HTTP)**

To run the gallery in VR mode, double-click run\_vr\_windows.bat.

This script starts a standard HTTP web server. This is sufficient for most VR devices and desktop browsing.

### **For AR (HTTPS)**

To run the gallery in AR mode, double-click run\_ar\_windows.bat.

**Why is this different?** WebXR's Augmented Reality features require a secure context to operate, which means the website must be served over **HTTPS**. This script handles the complexity for you:

1. It checks for an existing SSL certificate (cert.pem and key.pem).  
2. If a certificate is not found, it uses **OpenSSL** to generate a new self-signed certificate. (Note: This requires OpenSSL to be installed, which is included with Git for Windows).  
3. It then starts the web server using this certificate, serving the site over HTTPS.

When you first navigate to the https://localhost:8000 URL provided by the script, your browser will show a security warning. This is expected because the certificate is self-signed. You must click "Advanced" and then "Proceed to localhost" to view the application.