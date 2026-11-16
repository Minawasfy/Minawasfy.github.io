Gallery admin URL
https://minawasfy.github.io/Backend/

This page is intentionally not linked from the public gallery. Anyone who knows the URL can still open it.

To commit changes:
1. Create a fine-grained personal access token for Minawasfy/Minawasfy.github.io.
2. Grant the token Contents: Read and write permission.
3. Enter the token only in the confirmation dialog when you commit. The admin does not save it.
4. Commits are made directly to the main branch. GitHub Pages may take a short time to publish them.

Project data is stored in Data/projects.json. Screenshots are stored in Photos; 3D model files and their glTF dependencies are stored under Models; videos and GIFs are stored under Videos.

To add a 3D model:
1. Add its screenshots in the project editor.
2. Choose Add model files for a GLB or a glTF with all its companion files, or choose Add glTF folder to preserve the folder structure.
3. Select a screenshot as the model poster if desired. Use Showcase Order to arrange screenshots and models, then commit the changes.

The project page uses Google's open-source <model-viewer> component (no API key required) for interactive previews. Each uploaded file must be smaller than 100 MB. A newly uploaded GLB can be previewed in the editor; glTF packages preview from their saved URLs after the commit is deployed.

To add video or GIF showcases:
1. Choose one or multiple .mp4, .webm, or .gif files in the Videos & GIFs section. Each file must be smaller than 100 MB.
2. Select a screenshot as an optional poster. Posters are also shown instead of animated GIFs when a visitor has reduced motion enabled.
3. Arrange clips with screenshots and models in Showcase Order, then commit the changes.

Videos preload shortly before reaching the viewport, then start only when enough data is buffered. They play muted, inline, and loop while visible, then pause and release their source when scrolled away. GIFs are loaded only near the viewport. For smoothest playback, use short, web-optimized H.264 MP4 files; compressed MP4/WebM clips are usually much smaller than GIFs.
