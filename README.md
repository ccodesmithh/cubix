# CubiX - Adobe CEP Extension

This repository contains the source code for the CubiX Adobe CEP (Common Extensibility Platform) Extension. This extension is designed to enhance your workflow within Adobe Creative Cloud applications by providing custom panels and functionalities.

## Features

*   **Feature 1**: Describe the first key feature here.
*   **Feature 2**: Describe the second key feature here.
*   **Feature 3**: Describe the third key feature here.
    *(Please replace these with actual features of CubiX)*
*   **Smooth-Ease Continuity**: when applying easing to consecutive keyframe pairs the panel can optionally blend adjacent handles so the graph stays smooth instead of producing kinks. A checkbox labelled "Smooth adjacent handles" appears next to the apply button.
*   **Sync with AE selection**: a sync button (and ⌘R shortcut) reads the incoming/outgoing ease from the first selected key pair in After Effects and updates the curve editor accordingly.
*   **Bulk application continuity**: when you hit Apply with multiple (or all) keyframes selected the panel now calculates slopes for every segment and averages them across shared keys. This means you can safely apply a curve to an entire track without the middle keys suddenly flipping or introducing kinks — the graph will stay smooth as you’d expect from AE’s own UI.

## Installation

To install the CubiX extension, follow these steps:

1.  **Download the Extension**: Obtain the `.zxp` file (or the unzipped folder) for the CubiX extension.
2.  **Install with ZXP Installer (Recommended)**:
    *   Use a ZXP installer utility like Anastasiy's Extension Manager, ExMan Command Line Tool, or similar.
    *   Drag and drop the `.zxp` file into the installer, or use the installer's interface to browse and select the `.zxp` file.
3.  **Manual Installation (for unzipped folders)**:
    *   Locate the CEP extensions folder for your operating system:
        *   **Windows**: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions` or `C:\Users\<YOUR_USERNAME>\AppData\Roaming\Adobe\CEP\extensions`
        *   **macOS**: `/Library/Application Support/Adobe/CEP/extensions/` or `~/Library/Application Support/Adobe/CEP/extensions/`
    *   Place the unzipped CubiX folder directly into one of these `extensions` directories. Make sure the folder name matches the `ExtensionBundleId` specified in `manifest.xml`.

## Usage

Once installed, you can access the CubiX extension from within your Adobe Creative Cloud application (e.g., Photoshop, Illustrator, Premiere Pro).

1.  Open your Adobe application.
2.  Navigate to `Window > Extensions > CubiX` (the exact path might vary slightly based on the application and manifest configuration).
3.  The CubiX panel should now appear, ready for use.

## Development

If you are a developer interested in modifying or contributing to CubiX:

1.  **Clone the repository**:
    ```bash
    git clone [repository-url]
    cd CubiX
    ```
2.  **Dependencies**: (List any development dependencies here, e.g., Node.js, npm, specific build tools)
3.  **Build Process**: (Describe how to build the extension if there's a build step)
4.  **Debugging**: Enable debug mode in your Adobe applications to inspect the extension.

## Contributing

We welcome contributions! Please see `CONTRIBUTING.md` (if available) for details on how to submit pull requests, report bugs, and suggest features.

## License

This project is licensed under the [LICENSE NAME] - see the `LICENSE.md` file for details.
*(e.g., MIT License, Apache 2.0 License)*

## Contact

For questions, support, or feedback, please contact [Your Name/Email/Website].
